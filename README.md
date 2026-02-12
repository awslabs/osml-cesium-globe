# OSML Cesium Globe

A desktop application for visualizing and interacting with geospatial image processing results from the [OversightML](https://github.com/aws-solutions-library-samples/osml-model-runner) ecosystem. Built with CesiumJS, React, and Electron.

Submit image processing requests to SageMaker endpoints, monitor job status in real-time, and explore detected features on a 3D globe with rich property inspection.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Usage](#usage)
  - [Submitting an Image Request](#submitting-an-image-request)
  - [Loading GeoJSON Data](#loading-geojson-data)
  - [Loading Imagery](#loading-imagery)
  - [Inspecting Features](#inspecting-features)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Support & Feedback](#support--feedback)
- [Resources](#resources)
- [License](#license)

## Features

- **3D Globe Visualization** -- CesiumJS-powered globe with ArcGIS World Imagery (automatic offline fallback to Natural Earth II), atmosphere effects, dynamic sun lighting, and distance fog.
- **Image Processing Requests** -- Submit images from S3 to SageMaker endpoints for object detection with configurable tiling, compression, and feature distillation parameters.
- **Real-Time Job Monitoring** -- Track request status (pending, in-progress, success, error) through SQS polling with animated status indicators.
- **GeoJSON & Imagery Loading** -- Import feature collections and imagery from S3 buckets or local files with full layer management (visibility toggle, zoom-to, remove).
- **Feature Inspection** -- Click any detected feature on the globe to view a rich popup with grouped, hierarchical properties (classification, location, metadata) that tracks the feature's position as the camera moves.
- **Dark Glass-Morphism UI** -- Custom-built component system with backdrop blur, smooth animations, and a cinematic viewport vignette.
- **Electron Desktop App** -- Runs as a native desktop application with access to local filesystem and AWS credentials.

## Architecture

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 40 |
| UI framework | React 19, TypeScript 5 |
| 3D globe | CesiumJS 1.137, Resium |
| Build tool | Vite 7, vite-plugin-cesium, vite-plugin-electron |
| AWS services | S3, SageMaker, STS, SQS, DynamoDB (via AWS SDK v3) |
| Tile generation | Docker (`tumgis/ctb-quantized-mesh:alpine`) |

## Getting Started

### Prerequisites

Ensure the following are installed locally:

| Tool | Purpose |
|------|---------|
| [Node.js](https://nodejs.org/) >= 22.12.0 | Runtime & package manager |
| [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) | Credential management |
| [Docker](https://docs.docker.com/desktop/install/) | Image-to-tile conversion |

You will also need:

- Active AWS credentials configured under the `default` profile in `~/.aws/credentials`
- An [OSML Model Runner](https://github.com/aws-solutions-library-samples/osml-model-runner) deployment running in your AWS account (for image processing requests)

### Installation

1. **Clone the repository:**

   ```sh
   git clone https://github.com/aws-solutions-library-samples/osml-cesium-globe.git
   cd osml-cesium-globe
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Pull the tile generation Docker image:**

   ```sh
   docker pull tumgis/ctb-quantized-mesh:alpine
   ```

### Running the Application

1. **Load AWS credentials** into your terminal session using your preferred method ([guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html)).

2. **Start the development server:**

   ```sh
   npm run dev
   ```

   This launches both the Vite dev server and the Electron window.

3. **Build for production:**

   ```sh
   npm run build
   ```

4. **Clean build artifacts:**

   ```sh
   npm run clean
   ```

## Usage

### Submitting an Image Request

1. Open the side panel (hamburger menu, top-left)
2. Click **Submit Request**
3. Select an S3 bucket, image, and SageMaker endpoint
4. Configure tiling and feature distillation parameters (optional -- sensible defaults are provided)
5. Choose a results color and submit
6. Monitor progress via the status toast (bottom-right) and the pulsing indicator on the panel toggle

### Loading GeoJSON Data

1. Open the side panel and click **Load GeoJSON**
2. Choose **From S3** or **From Local** tab
3. Select a bucket and `.geojson`/`.json` file, or pick a local file from `src/data/geojson/`
4. The features are loaded onto the globe and appear in the Layers list

### Loading Imagery

1. Open the side panel and click **Load Image**
2. Select an S3 bucket and image file (GeoTIFF)
3. The image is downloaded, converted to Cesium tiles via Docker, and displayed on the globe

### Inspecting Features

Click any loaded feature on the globe to open the feature popup:

- **Grouped properties** -- Classification (IRI, score, confidence), Location, Metadata, and Details sections
- **Nested data** -- Object properties expand into collapsible sub-entries with chevron toggles
- **Position tracking** -- The popup follows the feature as you rotate/zoom the globe
- **Dismiss** -- Close button, Escape key, or click empty space

## Project Structure

```
osml-cesium-globe/
├── electron/               # Electron main & preload processes
├── scripts/                # Python/shell scripts for image processing
│   ├── calculate_extents.py
│   ├── generate_cesium_terrain.py
│   └── convert_data.sh
├── src/
│   ├── components/
│   │   ├── modal/          # DarkModal, ImageRequestModal, LoadDataModal, LoadImageModal
│   │   ├── ui/             # FormControls (DarkInput, DarkSelect, DarkAutosuggest, etc.)
│   │   ├── alert/          # CredsExpiredAlert
│   │   ├── OsmlMenu.tsx    # Main side panel with actions & layer management
│   │   ├── FeaturePopup.tsx # Feature click popup overlay
│   │   ├── ImageRequestStatus.tsx
│   │   ├── Logo.tsx
│   │   └── StatusDisplay.tsx
│   ├── context/
│   │   └── ResourceContext.tsx  # Global state for loaded layers/resources
│   ├── util/
│   │   ├── cesiumHelper.ts     # GeoJSON/imagery loading, feature click handling
│   │   ├── s3Helper.ts         # S3 bucket/object operations
│   │   ├── smHelper.ts         # SageMaker endpoint discovery
│   │   └── mrHelper.ts         # Model Runner request submission & polling
│   ├── config.ts           # AWS config, defaults, constants
│   ├── App.tsx             # Root component (Viewer, base layer, atmosphere)
│   ├── main.tsx            # Entry point
│   └── styles.css          # Global styles & vignette
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Configuration

Key defaults are defined in `src/config.ts`:

| Setting | Default | Description |
|---------|---------|-------------|
| `REGION` | auto-detected | AWS region for all service calls (see below) |
| `DEFAULT_TILE_SIZE` | `512` | Tile size for image processing |
| `DEFAULT_TILE_OVERLAP` | `128` | Tile overlap in pixels |
| `DEFAULT_FEATURE_DISTILLATION_ALGORITHM` | `NMS` | Non-Maximum Suppression |
| `DEFAULT_RESULTS_COLOR_OPTION` | Yellow | Default color for detected features |
| `ZOOM_MAX` / `ZOOM_MIN` | `18` / `7` | Imagery tile zoom range |

**AWS Region** is resolved automatically using the standard AWS precedence chain -- no source code edits required:

1. `AWS_REGION` environment variable
2. `AWS_DEFAULT_REGION` environment variable
3. `region` in `~/.aws/config` under the `[default]` profile
4. Falls back to `us-west-2` if none of the above are set

Local data directories:

| Path | Purpose |
|------|---------|
| `src/data/geojson/` | Local GeoJSON files for import |
| `src/data/images/` | Downloaded/local images for tile conversion |
| `src/data/tiles/imagery/` | Generated Cesium imagery tiles |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server + Electron |
| `npm run build` | TypeScript compile, Vite build, Electron package |
| `npm run preview` | Preview the Vite production build |
| `npm run clean` | Remove `node_modules` and `dist-electron` |

## Support & Feedback

OSML Cesium Globe is maintained by AWS Solution Architects. It is not part of an AWS service and support is provided best-effort by the OSML community.

To post feedback, submit feature ideas, or report bugs, please use the [Issues](https://github.com/aws-solutions-library-samples/osml-cesium-globe/issues) section of this GitHub repo.

If you are interested in contributing, see the [CONTRIBUTING](CONTRIBUTING.md) guide.

## Resources

- [CesiumJS](https://cesium.com/platform/cesiumjs/) -- 3D globe engine
- [Resium](https://resium.reearth.io/) -- React bindings for CesiumJS
- [Electron](https://www.electronjs.org/) -- Desktop application framework
- [AWS SDK for JavaScript v3](https://github.com/aws/aws-sdk-js-v3)
- [OSML Model Runner](https://github.com/aws-solutions-library-samples/osml-model-runner)

## License

MIT No Attribution Licensed. See [LICENSE](LICENSE).
