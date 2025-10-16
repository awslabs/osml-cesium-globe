#!/usr/bin/env python3

# Copyright 2025 Amazon.com, Inc. or its affiliates.

"""
Calculate geographic extents of a raster dataset using GDAL.

This script is designed to be run inside a Docker container with GDAL installed.
It calculates the geographic extents (north, south, east, west) of a raster dataset
and outputs the result as JSON.
"""

import os
import sys
import json
from osgeo import gdal, osr


def get_extents(dataset_path: str) -> dict:
    """
    Returns the geographic extents of the given raster dataset.

    :param dataset_path: Path to the raster dataset.
    :return: Dictionary with keys 'north', 'south', 'east', 'west' representing the extents.
    """
    try:
        # Open the dataset
        ds = gdal.Open(dataset_path)
        if ds is None:
            raise Exception(f"Unable to open dataset at {dataset_path}")

        # Get the source spatial reference
        projection = ds.GetProjection()
        src_srs = osr.SpatialReference()
        if projection:
            src_srs.ImportFromWkt(projection)
        else:
            # If no projection, assume WGS84
            src_srs.ImportFromEPSG(4326)

        # Define the target spatial reference (WGS84)
        tgt_srs = osr.SpatialReference()
        tgt_srs.ImportFromEPSG(4326)

        # Create coordinate transformation
        transform = osr.CoordinateTransformation(src_srs, tgt_srs)

        # Get the axis mapping to determine coordinate order
        # For geographic CRS, we need to check the axis order
        # For projected CRS, X is typically easting, Y is northing
        is_geographic = src_srs.IsGeographic()
        is_projected = src_srs.IsProjected()

        # Get the axis mapping from the CRS
        # This is a bit tricky - we need to check the axis order in the CRS
        # For geographic CRS, the order might be lat/lon or lon/lat
        # For projected CRS, it's typically X/Y (easting/northing)

        # Get image dimensions
        x_size = ds.RasterXSize
        y_size = ds.RasterYSize

        # Get geotransform
        geotransform = ds.GetGeoTransform()

        # Calculate corner coordinates in the source coordinate system
        # Using the geotransform: [x_origin, pixel_width, rotation, y_origin, rotation, pixel_height]
        x_origin = geotransform[0]
        pixel_width = geotransform[1]
        y_origin = geotransform[3]
        pixel_height = geotransform[5]

        # Calculate the four corners in source coordinates
        x_min = x_origin
        x_max = x_origin + x_size * pixel_width
        y_min = y_origin + y_size * pixel_height  # Note: pixel_height is usually negative
        y_max = y_origin

        # Ensure we have the correct min/max values
        if y_min > y_max:
            y_min, y_max = y_max, y_min
        if x_min > x_max:
            x_min, x_max = x_max, x_min

        # Transform the four corners to WGS84
        corners = [
            (x_min, y_max),  # Top-left
            (x_max, y_max),  # Top-right
            (x_max, y_min),  # Bottom-right
            (x_min, y_min)   # Bottom-left
        ]

        # Transform all corners to WGS84
        geo_corners = []
        for i, (x, y) in enumerate(corners):
            if is_geographic:
                # For geographic CRS, we need to check if the order is lat/lon or lon/lat
                # Most modern geographic CRS use lon/lat order, but some older ones use lat/lon
                # We'll try the standard lon/lat order first
                try:
                    # Try standard lon/lat order
                    lon, lat, _ = transform.TransformPoint(x, y)
                    # Check if the result makes sense (lat should be between -90 and 90)
                    if -90 <= lat <= 90 and -180 <= lon <= 180:
                        geo_corners.append((lon, lat))
                    else:
                        # If not, try lat/lon order
                        lat, lon, _ = transform.TransformPoint(y, x)
                        geo_corners.append((lon, lat))
                except:
                    # If transformation fails, try lat/lon order
                    try:
                        lat, lon, _ = transform.TransformPoint(y, x)
                        geo_corners.append((lon, lat))
                    except:
                        # Last resort: use the original order
                        lon, lat, _ = transform.TransformPoint(x, y)
                        geo_corners.append((lon, lat))
            else:
                # For projected CRS, X is typically easting, Y is northing
                # TransformPoint should handle the conversion correctly
                try:
                    lat, lon, _ = transform.TransformPoint(x, y)
                    geo_corners.append((lon, lat))
                except Exception as e:
                    # If transformation fails, try swapping coordinates
                    try:
                        lon, lat, _ = transform.TransformPoint(y, x)
                        geo_corners.append((lon, lat))
                    except:
                        # Last resort: use the original order
                        lon, lat, _ = transform.TransformPoint(x, y)
                        geo_corners.append((lon, lat))

        # Extract longitudes and latitudes
        lons = [coord[0] for coord in geo_corners]
        lats = [coord[1] for coord in geo_corners]

        # Compute extents
        extents = {
            "north": max(lats),
            "south": min(lats),
            "east": max(lons),
            "west": min(lons)
        }

        return extents

    except Exception as e:
        raise Exception(f"Error calculating extents: {str(e)}")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            print("Usage: python3 calculate_extents.py <dataset_path>", file=sys.stderr)
            sys.exit(1)

        dataset_path = sys.argv[1]
        extents = get_extents(dataset_path)
        print(json.dumps(extents))
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)
