# Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import argparse
import datetime
import docker
import glob
import os
import sys

# Constants
DOCKER_IMAGE: str = os.getenv('DOCKER_IMAGE', "tumgis/ctb-quantized-mesh:alpine")
JOB_NAME: str = os.getenv('JOB_NAME', "ctb-tile-creation")
DEFAULT_START_ZOOM: int = int(os.getenv('DEFAULT_START_ZOOM', "12"))
DEFAULT_END_ZOOM: int = int(os.getenv('DEFAULT_END_ZOOM', "0"))
TERRAIN_FOLDER_NAME = "terrain"

client = docker.from_env()


def log(message: str) -> None:
    """
    Log an informational message with the current timestamp.

    :param message: The message to be logged.
    :return: None
    """
    print(f"{datetime.datetime.now().strftime('%Y-%m-%d %T')} [INFO] {message}")


def error_exit(message: str) -> None:
    """
    Log an error message with the current timestamp and exit the script.

    :param message: The error message to be logged.
    :return: None
    """
    print(f"{datetime.datetime.now().strftime('%Y-%m-%d %T')} [ERROR] {message}", file=sys.stderr)
    sys.exit(1)


def cleanup() -> None:
    """
    Cleanup resources by stopping and removing the Docker container if it exists.

    :return: None
    """
    log("Cleaning up resources...")
    try:
        container = client.containers.get(JOB_NAME)
        container.stop()
        container.remove()
    except docker.errors.NotFound:
        pass


def exec_command(cmd):
    """
    Execute command inside docker container with JOB_NAME

    :return: None
    """
    container = client.containers.get(JOB_NAME)
    _, output = container.exec_run(f'/bin/bash -c "{cmd}"', tty=True, stream=True)
    for line in output:
        print(line.decode(), end='')


def main(directory, start_zoom, end_zoom, output_dir_name=None):
    """
    Main function to process the image conversion using Docker.

    :param directory: The directory containing the image files.
    :param start_zoom: The zoom level to start the conversion at.
    :param end_zoom: The zoom level to end the conversion at.
    :param output_dir_name: Name of folder in directory to place terrain files in.
    :return: None
    """
    # Validate inputs
    if not os.path.isdir(directory):
        error_exit(f"Directory {directory} does not exist.")
    if not len(glob.glob(os.path.join(directory, "*.tif"))):
        error_exit(f"Image directory {directory} does not contain any valid .tiff files.")
    if end_zoom < 0:
        error_exit(f"End zoom must be >= 0.")
    if end_zoom > start_zoom:
        error_exit(f"End zoom must be <= start zoom.")

    # Generate output directory
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    if not output_dir_name:
        output_dir_name = f"outputs_{timestamp}"
    absolute_output_dir = os.path.join(directory, output_dir_name)

    if not os.path.isdir(absolute_output_dir):
        os.makedirs(os.path.join(absolute_output_dir, TERRAIN_FOLDER_NAME))

    # Check Docker image
    client = docker.from_env()
    try:
        client.images.get(DOCKER_IMAGE)
    except docker.errors.ImageNotFound:
        error_exit(f"Docker image {DOCKER_IMAGE} not installed. Please run: docker pull {DOCKER_IMAGE}")

    # Start Docker container
    try:
        log(f"Initializing Docker Container...")
        client.containers.run(DOCKER_IMAGE, "tail -f /dev/null", name=
        JOB_NAME, detach=True, volumes={directory: {'bind': '/data', 'mode': 'rw'}})

        # Create layer.json file from VRT
        docker_vrt_path = os.path.join(output_dir_name, "tiles.vrt")
        docker_terrain_output_path = os.path.join(output_dir_name, TERRAIN_FOLDER_NAME)
        absolute_vrt_path = os.path.join(absolute_output_dir, "tiles.vrt")
        absolute_terrain_output_path = os.path.join(absolute_output_dir, TERRAIN_FOLDER_NAME)
        absolute_layer_metadata_path = os.path.join(absolute_terrain_output_path, "layer.json")

        if os.path.exists(absolute_vrt_path):
            log(f"VRT File already exists at {absolute_vrt_path}. Skipping...")
        else:
            log("Generating VRT File...")
            exec_command(f"gdalbuildvrt {docker_vrt_path} *.tif")
            log(f"Finished generating VRT File at {absolute_vrt_path}...")

        if os.path.exists(os.path.join(absolute_layer_metadata_path)):
            log(f"layer.json already exists at {absolute_layer_metadata_path}. Skipping...")
        else:
            log("Generating layer.json...")
            exec_command(f"ctb-tile -f Mesh -l -C -N -o {docker_terrain_output_path} {docker_vrt_path}")
            log(f"Finished generationg layer.json file at {absolute_layer_metadata_path}...")
        exec_command(
            f"ctb-tile -f Mesh -v -R -C -N -s {start_zoom} -e {end_zoom} -o {docker_terrain_output_path} {docker_vrt_path}")

    except docker.errors.ContainerError as e:
        error_exit(f"Error occurred: {e}")

    finally:
        # Cleanup
        cleanup()
        log("Conversion process completed successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert image files to terrain mesh using Docker.")
    parser.add_argument("-d", "--directory", required=True, help="Directory containing image files to be converted")
    parser.add_argument("-o", "--output-dir-name", required=False, default=None,
                        help="Name of output folder to be created in the image directory. This folder will contain all terrain outputs.")
    parser.add_argument("-s",
                        "--start-zoom",
                        required=False,
                        type=int,
                        default=DEFAULT_START_ZOOM,
                        help="specify the zoom level to start at. This should be greater than the end zoom level.")
    parser.add_argument("-e",
                        "--end-zoom",
                        required=False,
                        type=int,
                        default=DEFAULT_END_ZOOM,
                        help="specify the zoom level to end at. This should be less than the start zoom level and >= 0.")

    args = parser.parse_args()

    try:
        main(args.directory, args.start_zoom, args.end_zoom, args.output_dir_name)
    except KeyboardInterrupt:
        error_exit("Script interrupted by user")
