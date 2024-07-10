@echo off
setlocal

REM Download tomorrow's AQI forecast
powershell -command "wget 'https://s3-us-west-1.amazonaws.com/files.airnowtech.org/airnow/today/forecast_tomorrow_usa.kml' -O 'tomorrow_aqi.kml'"
if %errorlevel% neq 0 (
    echo Error: Failed to download tomorrow's AQI forecast.
    exit /b %errorlevel%
)

REM Download today's AQI forecast
powershell -command "wget 'https://s3-us-west-1.amazonaws.com/files.airnowtech.org/airnow/today/forecast_today_usa.kml' -O 'today_aqi.kml'"
if %errorlevel% neq 0 (
    echo Error: Failed to download today's AQI forecast.
    exit /b %errorlevel%
)

REM Convert KML to GeoJSON using k2g
k2g tomorrow_aqi.kml .\ -sf tomorrow_aqi.geojson
if %errorlevel% neq 0 (
    echo Error: Failed to convert tomorrow_aqi.kml to GeoJSON.
    exit /b %errorlevel%
)
del tomorrow_aqi.kml

k2g today_aqi.kml .\ -sf today_aqi.geojson
if %errorlevel% neq 0 (
    echo Error: Failed to convert today_aqi.kml to GeoJSON.
    exit /b %errorlevel%
)
echo Del
del today_aqi.kml

echo Batch script completed successfully.