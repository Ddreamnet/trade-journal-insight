<?php
/**
 * Market Series API - Stooq Historical Data
 * Endpoint: /api/market-series.php?asset=gold|usd|eur|bist100|nasdaq100
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Asset to Stooq symbol mapping
$ASSET_SYMBOLS = [
    'gold' => 'xautry.pl',
    'usd' => 'usdtry',
    'eur' => 'eurtry',
    'bist100' => 'xu100.pl',
    'nasdaq100' => 'ndx.us',
];

$CACHE_DIR = __DIR__ . '/cache';
$CACHE_DURATION = 30 * 60; // 30 minutes

// Get asset parameter
$asset = isset($_GET['asset']) ? strtolower(trim($_GET['asset'])) : '';

if (empty($asset) || !isset($ASSET_SYMBOLS[$asset])) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Invalid asset. Valid: gold, usd, eur, bist100, nasdaq100'
    ]);
    exit;
}

// Ensure cache directory exists
if (!is_dir($CACHE_DIR)) {
    mkdir($CACHE_DIR, 0755, true);
}

$cacheFile = $CACHE_DIR . '/market-series-' . $asset . '.json';

// Check cache
if (file_exists($cacheFile)) {
    $cacheAge = time() - filemtime($cacheFile);
    if ($cacheAge < $CACHE_DURATION) {
        // Return cached data
        echo file_get_contents($cacheFile);
        exit;
    }
}

// Fetch from Stooq
$symbol = $ASSET_SYMBOLS[$asset];
$url = "https://stooq.com/q/d/l/?s={$symbol}&i=d";

$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n",
        'timeout' => 30,
    ]
]);

$csv = @file_get_contents($url, false, $context);

if ($csv === false) {
    // Try to return stale cache
    if (file_exists($cacheFile)) {
        echo file_get_contents($cacheFile);
        exit;
    }
    
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch data from Stooq']);
    exit;
}

// Parse CSV
$lines = explode("\n", trim($csv));
$points = [];

// Skip header line
for ($i = 1; $i < count($lines); $i++) {
    $parts = str_getcsv($lines[$i]);
    if (count($parts) >= 5) {
        $date = $parts[0];
        $close = floatval($parts[4]);
        
        if (!empty($date) && $close > 0) {
            $points[] = [
                'date' => $date,
                'value' => $close
            ];
        }
    }
}

// Sort by date ascending
usort($points, function($a, $b) {
    return strcmp($a['date'], $b['date']);
});

// Keep last 365 days
$points = array_slice($points, -365);

$response = [
    'asset' => $asset,
    'updatedAt' => date('c'),
    'points' => array_values($points)
];

$json = json_encode($response, JSON_UNESCAPED_UNICODE);

// Save to cache
file_put_contents($cacheFile, $json);

echo $json;
