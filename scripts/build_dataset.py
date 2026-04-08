#!/usr/bin/env python
"""
Build dataset artifacts for the mobility app from raw tabular and geographic sources.

The pipeline is driven by a YAML config so adding a new city is mostly:
1. Copy a config file
2. Point it to the raw files
3. Run this script
"""

from __future__ import annotations

import argparse
import glob
import os
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import yaml


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WGS84_EPSG = 4326


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def resolve_path(raw_path: str, *, allow_glob: bool = True) -> Path:
    expanded = os.path.expandvars(os.path.expanduser(raw_path))

    if allow_glob and any(token in expanded for token in ["*", "?", "["]):
        matches = sorted(Path(match).resolve() for match in glob.glob(expanded, recursive=True))
        if not matches:
            raise FileNotFoundError(f"No file matched glob: {raw_path}")
        return matches[0]

    path = Path(expanded).resolve()
    if not path.exists():
        raise FileNotFoundError(f"File not found: {raw_path}")
    return path


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def resolve_output_path(dataset_cfg: dict[str, Any], relative_path: str) -> Path:
    output_root = dataset_cfg.get("output_root", "public/data")
    output_subdir = dataset_cfg.get("output_subdir", dataset_cfg["id"])
    return (PROJECT_ROOT / output_root / output_subdir / relative_path).resolve()


def infer_format(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return "csv"
    if suffix in {".xlsx", ".xls"}:
        return "xlsx"
    if suffix == ".parquet":
        return "parquet"
    if suffix in {".shp", ".geojson", ".json", ".gpkg"}:
        return "geofile"
    raise ValueError(f"Unsupported file format for {path}")


def read_table(source_cfg: dict[str, Any]) -> pd.DataFrame:
    path = resolve_path(source_cfg["path"])
    fmt = source_cfg.get("format", infer_format(path))
    read_options = source_cfg.get("read_options", {})

    print(f"Reading table source: {path}")

    if fmt == "csv":
        df = pd.read_csv(path, **read_options)
    elif fmt == "xlsx":
        try:
            import openpyxl  # noqa: F401
        except ImportError as exc:
            raise RuntimeError(
                "Excel input requires openpyxl. Install it with `pip install openpyxl`."
            ) from exc
        df = pd.read_excel(path, **read_options)
    elif fmt == "parquet":
        df = pd.read_parquet(path, **read_options)
    else:
        raise ValueError(f"Unsupported table format: {fmt}")

    for column_name in source_cfg.get("drop_columns", []):
        if column_name in df.columns:
            df = df.drop(columns=[column_name])

    return df


def read_geodata(source_cfg: dict[str, Any]) -> gpd.GeoDataFrame:
    path = resolve_path(source_cfg["path"])
    fmt = source_cfg.get("format", infer_format(path))
    if fmt != "geofile":
        raise ValueError(f"Geographic source must be a geofile, got: {fmt}")

    print(f"Reading geographic source: {path}")
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        fallback_crs = source_cfg.get("fallback_crs")
        if not fallback_crs:
            raise ValueError(f"Geodata source {path} has no CRS and no fallback_crs was provided.")
        gdf = gdf.set_crs(fallback_crs)

    return gdf


def build_base_flows(raw_df: pd.DataFrame, base_cfg: dict[str, Any], dataset_cfg: dict[str, Any]) -> pd.DataFrame:
    column_map = base_cfg["columns"]
    output_df = pd.DataFrame(
        {
            "origin_code": raw_df[column_map["origin_code"]].astype("string"),
            "origin_name": raw_df[column_map.get("origin_name", column_map["origin_code"])].astype("string"),
            "dest_code": raw_df[column_map["dest_code"]].astype("string"),
            "dest_name": raw_df[column_map.get("dest_name", column_map["dest_code"])].astype("string"),
            "count": pd.to_numeric(raw_df[column_map["count"]], errors="coerce").fillna(0).astype("int64"),
        }
    )

    if base_cfg.get("drop_zero_counts", True):
        output_df = output_df[output_df["count"] > 0].copy()

    output_path = resolve_output_path(dataset_cfg, f"processed/{base_cfg['output_file']}")
    ensure_parent(output_path)
    pq.write_table(pa.Table.from_pandas(output_df, preserve_index=False), output_path)

    print(f"Wrote base flows parquet: {output_path}")
    print(f"  rows={len(output_df):,}")
    return output_df


def build_dimension_dataset(raw_df: pd.DataFrame, base_cfg: dict[str, Any], dimension_cfg: dict[str, Any], dataset_cfg: dict[str, Any]) -> Path:
    base_columns = base_cfg["columns"]
    rows: list[pd.DataFrame] = []

    for index, category in enumerate(dimension_cfg["categories"], start=1):
        category_value = category["value"]
        source_column = category["source_column"]
        category_code = category.get("code", index)

        category_df = pd.DataFrame(
            {
                "origin_code": raw_df[base_columns["origin_code"]].astype("string"),
                "dest_code": raw_df[base_columns["dest_code"]].astype("string"),
                dimension_cfg["code_column"]: pd.Series(category_code, index=raw_df.index, dtype="int64"),
                dimension_cfg["category_column"]: pd.Series(category_value, index=raw_df.index, dtype="string"),
                "count": pd.to_numeric(raw_df[source_column], errors="coerce").fillna(0).astype("int64"),
            }
        )

        if dimension_cfg.get("drop_zero_counts", True):
            category_df = category_df[category_df["count"] > 0].copy()

        rows.append(category_df)

    output_df = pd.concat(rows, ignore_index=True)
    output_path = resolve_output_path(dataset_cfg, f"processed/{dimension_cfg['output_file']}")
    ensure_parent(output_path)
    pq.write_table(pa.Table.from_pandas(output_df, preserve_index=False), output_path)

    print(f"Wrote dimension parquet: {output_path}")
    print(f"  key={dimension_cfg['key']} rows={len(output_df):,}")
    return output_path


def prepare_geodata(gdf: gpd.GeoDataFrame, simplify_tolerance: float | None = None) -> gpd.GeoDataFrame:
    prepared = gdf.to_crs(epsg=WGS84_EPSG).copy()
    if simplify_tolerance:
        prepared["geometry"] = prepared.geometry.simplify(
            tolerance=simplify_tolerance,
            preserve_topology=True,
        )
    return prepared


def write_base_geography(base_gdf: gpd.GeoDataFrame, geography_cfg: dict[str, Any], dataset_cfg: dict[str, Any]) -> gpd.GeoDataFrame:
    base_cfg = geography_cfg["base"]
    prepared = prepare_geodata(base_gdf, base_cfg.get("simplify_tolerance"))

    centroids = prepared.geometry.representative_point()
    centroid_name_column = base_cfg.get("centroid_name_column", base_cfg["name_column"])
    centroids_df = pd.DataFrame(
        {
            "code": prepared[base_cfg["code_column"]].astype("string"),
            "name": prepared[centroid_name_column].astype("string"),
            "lat": centroids.y,
            "lon": centroids.x,
        }
    ).drop_duplicates(subset=["code"]).sort_values("code")

    centroids_path = resolve_output_path(dataset_cfg, "lookup/areas_centroids.csv")
    ensure_parent(centroids_path)
    centroids_df.to_csv(centroids_path, index=False)
    print(f"Wrote base centroids: {centroids_path}")

    boundaries = prepared[[base_cfg["code_column"], base_cfg["name_column"], "geometry"]].copy()
    boundaries = boundaries.rename(
        columns={
            base_cfg["code_column"]: "code",
            base_cfg["name_column"]: "name",
        }
    )
    boundaries_path = resolve_output_path(dataset_cfg, "lookup/boundaries.geojson")
    ensure_parent(boundaries_path)
    boundaries.to_file(boundaries_path, driver="GeoJSON")
    print(f"Wrote base boundaries: {boundaries_path}")

    return prepared


def build_aggregate_lookup(base_gdf: gpd.GeoDataFrame, geography_cfg: dict[str, Any], dataset_cfg: dict[str, Any]) -> pd.DataFrame:
    lookup_cfg = geography_cfg["aggregate_lookup"]

    lookup_df = pd.DataFrame(
        {
            lookup_cfg.get("output_base_code_column", "msoa21cd"): base_gdf[lookup_cfg["base_code_column"]].astype("string"),
            lookup_cfg.get("output_base_name_column", "msoa21nm"): base_gdf[
                lookup_cfg.get("base_name_column", lookup_cfg["base_code_column"])
            ].astype("string"),
            lookup_cfg.get("output_aggregate_code_column", "ltla22cd"): base_gdf[
                lookup_cfg["aggregate_code_column"]
            ].astype("string"),
            lookup_cfg.get("output_aggregate_name_column", "ltla22nm"): base_gdf[
                lookup_cfg.get("aggregate_name_column", lookup_cfg["aggregate_code_column"])
            ].astype("string"),
        }
    ).drop_duplicates()

    lookup_path = resolve_output_path(dataset_cfg, "lookup/aggregate_lookup.csv")
    ensure_parent(lookup_path)
    lookup_df.to_csv(lookup_path, index=False)

    print(f"Wrote aggregate lookup: {lookup_path}")
    print(f"  rows={len(lookup_df):,}")
    return lookup_df


def build_aggregate_geography(
    aggregate_gdf: gpd.GeoDataFrame | None,
    base_gdf: gpd.GeoDataFrame,
    lookup_df: pd.DataFrame,
    geography_cfg: dict[str, Any],
    dataset_cfg: dict[str, Any],
) -> None:
    aggregate_cfg = geography_cfg["aggregate"]
    prepared_lookup_base = prepare_geodata(base_gdf, aggregate_cfg.get("dissolve_simplify_tolerance"))

    if aggregate_gdf is not None:
        prepared_aggregate = prepare_geodata(aggregate_gdf, aggregate_cfg.get("simplify_tolerance"))
        aggregate_boundaries = gpd.GeoDataFrame(
            {
                aggregate_cfg["code_column"]: prepared_aggregate[aggregate_cfg["code_column"]].astype("string"),
                aggregate_cfg["name_column"]: prepared_aggregate[aggregate_cfg["name_column"]].astype("string"),
            },
            geometry=prepared_aggregate.geometry,
            crs=prepared_aggregate.crs,
        )
    else:
        lookup_columns = geography_cfg["aggregate_lookup"]
        aggregate_code_output_col = lookup_columns.get("output_aggregate_code_column", "ltla22cd")
        aggregate_name_output_col = lookup_columns.get("output_aggregate_name_column", "ltla22nm")
        left = prepared_lookup_base.merge(
            lookup_df,
            left_on=lookup_columns["base_code_column"],
            right_on=lookup_columns.get("output_base_code_column", "msoa21cd"),
            how="left",
        )
        left = left.dropna(subset=[aggregate_code_output_col])
        aggregate_boundaries = left.dissolve(by=aggregate_code_output_col, as_index=False)

        name_map = (
            lookup_df[[aggregate_code_output_col, aggregate_name_output_col]]
            .drop_duplicates(subset=[aggregate_code_output_col])
            .set_index(aggregate_code_output_col)[aggregate_name_output_col]
        )
        aggregate_boundaries[aggregate_name_output_col] = (
            aggregate_boundaries[aggregate_code_output_col]
            .astype("string")
            .map(name_map)
            .astype("string")
        )
        aggregate_boundaries = aggregate_boundaries.rename(
            columns={
                aggregate_code_output_col: aggregate_cfg["code_column"],
                aggregate_name_output_col: aggregate_cfg["name_column"],
            }
        )

    aggregate_code_column = aggregate_cfg["code_column"]
    aggregate_name_column = aggregate_cfg["name_column"]
    aggregate_code_output_col = aggregate_cfg.get("boundary_code_property", "ltla_code")
    aggregate_name_output_col = aggregate_cfg.get("boundary_name_property", "ltla_name")

    centroids = aggregate_boundaries.geometry.representative_point()
    centroid_df = pd.DataFrame(
        {
            "code": aggregate_boundaries[aggregate_code_column].astype("string"),
            "name": aggregate_boundaries[
                aggregate_cfg.get("centroid_name_column", aggregate_name_column)
            ].astype("string"),
            "lat": centroids.y,
            "lon": centroids.x,
        }
    )

    centroid_count_column = aggregate_cfg.get("centroid_count_column")
    if centroid_count_column:
        lookup_count_col = geography_cfg["aggregate_lookup"].get("output_aggregate_code_column", "ltla22cd")
        counts = (
            lookup_df.groupby(lookup_count_col)
            .size()
            .rename(centroid_count_column)
            .reset_index()
        )
        centroid_df = centroid_df.merge(
            counts,
            left_on="code",
            right_on=lookup_count_col,
            how="left",
        ).drop(columns=[lookup_count_col])
        centroid_df[centroid_count_column] = centroid_df[centroid_count_column].fillna(0).astype("int64")

    centroid_path = resolve_output_path(dataset_cfg, "lookup/aggregate_centroids.csv")
    ensure_parent(centroid_path)
    centroid_df.sort_values("code").to_csv(centroid_path, index=False)
    print(f"Wrote aggregate centroids: {centroid_path}")

    boundaries = gpd.GeoDataFrame(
        {
            aggregate_code_output_col: aggregate_boundaries[aggregate_code_column].astype("string"),
            aggregate_name_output_col: aggregate_boundaries[aggregate_name_column].astype("string"),
        },
        geometry=aggregate_boundaries.geometry,
        crs=aggregate_boundaries.crs,
    )
    boundaries_path = resolve_output_path(dataset_cfg, "lookup/aggregate_boundaries.geojson")
    ensure_parent(boundaries_path)
    boundaries.to_file(boundaries_path, driver="GeoJSON")
    print(f"Wrote aggregate boundaries: {boundaries_path}")


def validate_outputs(
    base_flows_df: pd.DataFrame,
    base_geography_df: gpd.GeoDataFrame,
    lookup_df: pd.DataFrame,
    geography_cfg: dict[str, Any],
) -> None:
    flow_codes = pd.Index(
        pd.concat([base_flows_df["origin_code"], base_flows_df["dest_code"]]).astype("string").unique()
    )
    geography_codes = pd.Index(base_geography_df[geography_cfg["base"]["code_column"]].astype("string").unique())
    missing_base_codes = flow_codes.difference(geography_codes)

    lookup_columns = geography_cfg["aggregate_lookup"]
    lookup_base_codes = pd.Index(
        lookup_df[lookup_columns.get("output_base_code_column", "msoa21cd")].astype("string").unique()
    )
    missing_lookup_codes = flow_codes.difference(lookup_base_codes)

    print("Validation summary:")
    print(f"  base flow codes={len(flow_codes):,}")
    print(f"  base geography codes={len(geography_codes):,}")
    print(f"  aggregate lookup rows={len(lookup_df):,}")
    print(f"  missing flow codes in base geography={len(missing_base_codes):,}")
    print(f"  missing flow codes in aggregate lookup={len(missing_lookup_codes):,}")

    if len(missing_base_codes) > 0:
        preview = ", ".join(str(code) for code in missing_base_codes[:10])
        print(f"  warning: first missing base geography codes: {preview}")

    if len(missing_lookup_codes) > 0:
        preview = ", ".join(str(code) for code in missing_lookup_codes[:10])
        print(f"  warning: first missing aggregate lookup codes: {preview}")


def build_dataset(config_path: Path) -> None:
    config = load_yaml(config_path)
    dataset_cfg = config["dataset"]
    flows_cfg = config["flows"]
    geography_cfg = config["geography"]

    print("=" * 72)
    print(f"Building dataset: {dataset_cfg['id']}")
    print("=" * 72)

    raw_flows_df = read_table(flows_cfg["source"])
    print(f"Loaded raw flows rows={len(raw_flows_df):,}")

    base_flows_df = build_base_flows(raw_flows_df, flows_cfg["base"], dataset_cfg)

    for dimension_cfg in flows_cfg.get("dimensions", []):
        if dimension_cfg.get("source") == "base":
            source_df = raw_flows_df
        elif "source" in dimension_cfg and isinstance(dimension_cfg["source"], dict):
            source_df = read_table(dimension_cfg["source"])
        else:
            source_df = raw_flows_df

        build_dimension_dataset(source_df, flows_cfg["base"], dimension_cfg, dataset_cfg)

    base_gdf = read_geodata(geography_cfg["base"]["source"])
    prepared_base_gdf = write_base_geography(base_gdf, geography_cfg, dataset_cfg)

    lookup_df = build_aggregate_lookup(prepared_base_gdf, geography_cfg, dataset_cfg)

    aggregate_cfg = geography_cfg["aggregate"]
    aggregate_source_cfg = aggregate_cfg.get("source")
    aggregate_gdf = read_geodata(aggregate_source_cfg) if aggregate_source_cfg else None
    build_aggregate_geography(aggregate_gdf, prepared_base_gdf, lookup_df, geography_cfg, dataset_cfg)

    validate_outputs(base_flows_df, prepared_base_gdf, lookup_df, geography_cfg)

    print("\nPipeline completed successfully.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build processed data artifacts for a dataset.")
    parser.add_argument(
        "--config",
        required=True,
        help="Path to the YAML config file for the dataset pipeline.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = Path(args.config).resolve()
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    build_dataset(config_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
