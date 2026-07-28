#!/usr/bin/env python3
"""Convert the supplied direct-dealer export to the product-mix builder contract."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path


SOURCE_COLUMNS = [
    "Billing Date",
    "Invoice Number",
    "Customer ID",
    "Sales Rep ID",
    "Region",
    "Item Code",
    "Item Description",
    "Qty.",
    "Net Value",
]

TARGET_COLUMNS = [
    "Date",
    "Invoice Number",
    "Product ID",
    "Product",
    "Distributor ID",
    "Sales Rep ID",
    "Outlet ID",
    "Outlet Group",
    "Transaction Type",
    "Sale Type",
    "Area",
    "Quantity",
    "Net Value",
]


def number(value: str) -> Decimal:
    try:
        return Decimal((value or "0").replace(",", "").strip())
    except InvalidOperation as exc:
        raise ValueError(f"Invalid number: {value!r}") from exc


def clean_area(region: str) -> str:
    label = (region or "").strip()
    if "|" in label:
        label = label.split("|", 1)[1].strip()
    return label or "UNKNOWN"


def decimal_text(value: Decimal) -> str:
    return f"{value:.2f}"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--audit", type=Path, required=True)
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.audit.parent.mkdir(parents=True, exist_ok=True)

    source_rows: list[dict[str, str]] = []
    area_value_by_customer: dict[str, Counter[str]] = defaultdict(Counter)
    area_rows_by_customer: dict[str, Counter[str]] = defaultdict(Counter)

    with args.source.open("r", encoding="utf-8-sig", newline="") as source_stream:
        reader = csv.DictReader(source_stream)
        if reader.fieldnames != SOURCE_COLUMNS:
            raise ValueError(
                f"Unexpected source columns. Expected {SOURCE_COLUMNS!r}, got {reader.fieldnames!r}"
            )
        for row in reader:
            customer_id = row["Customer ID"].strip()
            area = clean_area(row["Region"])
            net_value = number(row["Net Value"])
            source_rows.append(row)
            area_rows_by_customer[customer_id][area] += 1
            if net_value > 0:
                area_value_by_customer[customer_id][area] += net_value

    primary_area_by_customer: dict[str, str] = {}
    for customer_id, row_counts in area_rows_by_customer.items():
        value_counts = area_value_by_customer[customer_id]
        primary_area_by_customer[customer_id] = max(
            row_counts,
            key=lambda area: (value_counts[area], row_counts[area], area),
        )

    multi_area_customers = {
        customer_id: sorted(areas)
        for customer_id, areas in area_rows_by_customer.items()
        if len(areas) > 1
    }

    row_count = 0
    invoices: set[str] = set()
    customers: set[str] = set()
    products: set[str] = set()
    areas: set[str] = set()
    transaction_counts: Counter[str] = Counter()
    quantity_total = Decimal("0")
    net_value_total = Decimal("0")
    missing_required: Counter[str] = Counter()

    with args.output.open("w", encoding="utf-8", newline="") as output_stream:
        writer = csv.DictWriter(output_stream, fieldnames=TARGET_COLUMNS)
        writer.writeheader()

        for source_row, row in enumerate(source_rows, start=2):
            invoice_id = row["Invoice Number"].strip()
            customer_id = row["Customer ID"].strip()
            product_id = row["Item Code"].strip()
            quantity = number(row["Qty."])
            net_value = number(row["Net Value"])
            area = primary_area_by_customer[customer_id]
            movement = "Return" if quantity < 0 or net_value < 0 else "Sales"

            for column, value in (
                ("Invoice Number", invoice_id),
                ("Customer ID", customer_id),
                ("Item Code", product_id),
            ):
                if not value:
                    missing_required[column] += 1

            writer.writerow(
                {
                    "Date": row["Billing Date"].strip(),
                    "Invoice Number": invoice_id,
                    "Product ID": product_id,
                    "Product": row["Item Description"].strip(),
                    "Distributor ID": customer_id,
                    "Sales Rep ID": row["Sales Rep ID"].strip(),
                    "Outlet ID": customer_id,
                    "Outlet Group": "DIRECT DEALER",
                    "Transaction Type": movement,
                    "Sale Type": "Normal Sales",
                    "Area": area,
                    "Quantity": decimal_text(quantity),
                    "Net Value": decimal_text(net_value),
                }
            )

            row_count += 1
            invoices.add(invoice_id)
            customers.add(customer_id)
            products.add(product_id)
            areas.add(area)
            transaction_counts[movement] += 1
            quantity_total += quantity
            net_value_total += net_value

    if missing_required:
        raise ValueError(f"Missing required identifiers: {dict(missing_required)}")

    audit = {
        "status": "validated",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceFile": str(args.source.resolve()),
        "sourceSha256": sha256(args.source),
        "outputFile": str(args.output.resolve()),
        "outputSha256": sha256(args.output),
        "mapping": {
            "customerKey": "Customer ID -> Outlet ID and Distributor ID",
            "region": (
                "Each customer is assigned one dominant Area, selected by highest positive "
                "six-month net sales, then line count and area name as deterministic tie-breakers"
            ),
            "transactionType": "Return when quantity or net value is negative; otherwise Sales",
            "outletGroup": "DIRECT DEALER because the source has no outlet-group field",
            "saleType": "Normal Sales because the source has no sale-type field",
        },
        "rowCount": row_count,
        "invoiceCount": len(invoices),
        "customerCount": len(customers),
        "productCount": len(products),
        "areaCount": len(areas),
        "multiAreaCustomerCount": len(multi_area_customers),
        "multiAreaCustomers": multi_area_customers,
        "transactionCounts": dict(transaction_counts),
        "quantityTotal": decimal_text(quantity_total),
        "netValueTotal": decimal_text(net_value_total),
        "missingRequiredIdentifiers": dict(missing_required),
    }
    args.audit.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
