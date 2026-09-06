#!/usr/bin/env python3
"""Read-only audit-pack inventory and bounded prompt retrieval. Never resets the tracker."""

import argparse
import csv
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read_csv(name):
    with (ROOT / name).open(newline="") as stream:
        return list(csv.DictReader(stream))


def inventory():
    components = read_csv("ForeKingHell-completion-tracker.csv")
    routes = read_csv("ForeKingHell-route-coverage.csv")
    ids = [row["component_id"] for row in components]
    assert len(ids) == len(set(ids)) == 492, "Tracker must retain all 492 unique IDs"
    assert len(routes) == 98, "Route matrix must retain all 98 entries"
    covered = []
    for route in routes:
        route_ids = [value.strip() for value in route["component_ids"].split(";") if value.strip()]
        assert len(route_ids) == int(route["component_count"]), route["page_id"]
        assert set(route_ids).issubset(ids), route["page_id"]
        assert (ROOT / route["source"]).exists(), f"Missing route source: {route['source']}"
        covered.extend(route_ids)
    assert len(covered) == len(set(covered)) == 478, "Every route component must occur once"
    for row in components:
        for viewport in ("desktop", "mobile"):
            if row[f"{viewport}_status"].strip().lower() == "passed":
                assert row[f"{viewport}_evidence"].strip(), f"Missing evidence: {row['component_id']} {viewport}"
    return components, routes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["status", "validate", "prompt"])
    parser.add_argument("component", nargs="?")
    args = parser.parse_args()
    components, routes = inventory()
    if args.command == "prompt":
        if args.component not in {row["component_id"] for row in components}:
            parser.error("Supply an exact existing component ID, for example G01 or P01-C01")
        text = (ROOT / "ForeKingHell-prompts.md").read_text()
        match = re.search(rf"^#### {re.escape(args.component)} ·.*?(?=^###? |^#### |\Z)", text, re.M | re.S)
        if not match:
            parser.error("Component prompt boundary not found; inspect the specification directly")
        print(match.group().rstrip())
        return
    print(f"Inventory valid: {len(components)} components; {len(routes)} routes.")
    if args.command == "validate":
        return
    for viewport in ("desktop", "mobile"):
        print(f"{viewport}: {dict(Counter(row[f'{viewport}_status'] for row in components))}")
    initial = ["G01", "G05", "G06", "G10"]
    shared = initial + [f"G{number:02d}" for number in range(1, 15) if f"G{number:02d}" not in initial]
    priority_pages = ["P01", "P35", "P36"]
    page_order = priority_pages + [row["page_id"] for row in routes if row["page_id"] not in priority_pages]
    order = {value: index for index, value in enumerate(shared + page_order)}
    unfinished = [row for row in components if any(row[f"{viewport}_status"].strip().lower() != "passed" for viewport in ("desktop", "mobile"))]
    unfinished.sort(key=lambda row: (order.get(row["component_id"].split("-")[0], 999), row["component_id"]))
    print(f"Rows not passed on both viewports: {len(unfinished)}")
    if unfinished:
        row = unfinished[0]
        print(f"Resume: {row['component_id']} — {row['component']} ({row['route']})")
        print(f"Blocker/outstanding: {row['blocker'] or 'Not yet implemented and verified'}")


if __name__ == "__main__":
    main()
