$tempDir = "abuja_elite_export_temp"
$zipPath = "abuja_elite_export.zip"

# Clean up
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue

# Create temp directory
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Copy PROJECT_NOTES.md
Copy-Item -Path "PROJECT_NOTES.md" -Destination "$tempDir\PROJECT_NOTES.md" -Force

# Copy main app files
New-Item -ItemType Directory -Path "$tempDir\artifacts\abuja-elite" -Force | Out-Null
Copy-Item -Path "artifacts\abuja-elite\package.json" -Destination "$tempDir\artifacts\abuja-elite\package.json" -Force
Copy-Item -Path "artifacts\abuja-elite\components.json" -Destination "$tempDir\artifacts\abuja-elite\components.json" -Force
Copy-Item -Path "artifacts\abuja-elite\vite.config.ts" -Destination "$tempDir\artifacts\abuja-elite\vite.config.ts" -Force
Copy-Item -Path "artifacts\abuja-elite\tsconfig.json" -Destination "$tempDir\artifacts\abuja-elite\tsconfig.json" -Force
Copy-Item -Path "artifacts\abuja-elite\index.html" -Destination "$tempDir\artifacts\abuja-elite\index.html" -Force

# Copy src directory structure
New-Item -ItemType Directory -Path "$tempDir\artifacts\abuja-elite\src" -Force | Out-Null

# Copy main src files
Copy-Item -Path "artifacts\abuja-elite\src\App.tsx" -Destination "$tempDir\artifacts\abuja-elite\src\App.tsx" -Force
Copy-Item -Path "artifacts\abuja-elite\src\main.tsx" -Destination "$tempDir\artifacts\abuja-elite\src\main.tsx" -Force
Copy-Item -Path "artifacts\abuja-elite\src\index.css" -Destination "$tempDir\artifacts\abuja-elite\src\index.css" -Force
Copy-Item -Path "artifacts\abuja-elite\src\vite-env.d.ts" -Destination "$tempDir\artifacts\abuja-elite\src\vite-env.d.ts" -Force

# Copy components
New-Item -ItemType Directory -Path "$tempDir\artifacts\abuja-elite\src\components" -Force | Out-Null
Copy-Item -Path "artifacts\abuja-elite\src\components\*" -Destination "$tempDir\artifacts\abuja-elite\src\components\" -Recurse -Force

# Copy features
New-Item -ItemType Directory -Path "$tempDir\artifacts\abuja-elite\src\features" -Force | Out-Null
Copy-Item -Path "artifacts\abuja-elite\src\features\*" -Destination "$tempDir\artifacts\abuja-elite\src\features\" -Recurse -Force

# Copy hooks
New-Item -ItemType Directory -Path "$tempDir\artifacts\abuja-elite\src\hooks" -Force | Out-Null
Copy-Item -Path "artifacts\abuja-elite\src\hooks\*" -Destination "$tempDir\artifacts\abuja-elite\src\hooks\" -Recurse -Force

# Copy lib
New-Item -ItemType Directory -Path "$tempDir\artifacts\abuja-elite\src\lib" -Force | Out-Null
Copy-Item -Path "artifacts\abuja-elite\src\lib\*" -Destination "$tempDir\artifacts\abuja-elite\src\lib\" -Recurse -Force

# Copy pages
New-Item -ItemType Directory -Path "$tempDir\artifacts\abuja-elite\src\pages" -Force | Out-Null
Copy-Item -Path "artifacts\abuja-elite\src\pages\*" -Destination "$tempDir\artifacts\abuja-elite\src\pages\" -Recurse -Force

# Copy public assets (favicons only)
New-Item -ItemType Directory -Path "$tempDir\artifacts\abuja-elite\public" -Force | Out-Null
Copy-Item -Path "artifacts\abuja-elite\public\favicon.png" -Destination "$tempDir\artifacts\abuja-elite\public\favicon.png" -Force
Copy-Item -Path "artifacts\abuja-elite\public\favicon.svg" -Destination "$tempDir\artifacts\abuja-elite\public\favicon.svg" -Force
Copy-Item -Path "artifacts\abuja-elite\public\robots.txt" -Destination "$tempDir\artifacts\abuja-elite\public\robots.txt" -Force

# Create zip
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force

# Cleanup temp directory
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Zip created at: $((Get-Location).Path)\$zipPath"
