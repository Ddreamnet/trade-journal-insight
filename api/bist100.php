<?php
/**
 * BIST100 Hisse Verileri API
 * Kaynak: hangikredi.com
 * Cache: 60 saniye
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Cache ayarları
$cache_dir = __DIR__ . '/cache';
$cache_file = $cache_dir . '/bist100.json';
$cache_time = 60; // 60 saniye

// Cache klasörü yoksa oluştur
if (!is_dir($cache_dir)) {
    mkdir($cache_dir, 0755, true);
}

// Cache kontrolü - 60 saniyeden yeni ise cache'i döndür
if (file_exists($cache_file) && (time() - filemtime($cache_file)) < $cache_time) {
    readfile($cache_file);
    exit;
}

// Upstream URL
$upstream_url = 'https://www.hangikredi.com/yatirim-araclari/hisse-senetleri/bist-100-hisseleri';

// User-Agent ile HTML çekme
$options = [
    'http' => [
        'method' => 'GET',
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n" .
                   "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8\r\n" .
                   "Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7\r\n",
        'timeout' => 30
    ]
];
$context = stream_context_create($options);
$html = @file_get_contents($upstream_url, false, $context);

if ($html === false) {
    // HTML çekilemedi - eski cache varsa onu döndür
    if (file_exists($cache_file)) {
        error_log("BIST100: Failed to fetch upstream, returning cached data");
        readfile($cache_file);
        exit;
    }
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch data from upstream', 'updatedAt' => date('c')]);
    exit;
}

// HTML'den veri çıkarma
$items = [];

// DOMDocument ile parse et
libxml_use_internal_errors(true);
$dom = new DOMDocument();
$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
libxml_clear_errors();

$xpath = new DOMXPath($dom);

// Tablo satırlarını bul - hangikredi.com yapısına göre
$rows = $xpath->query('//table//tbody//tr');

if ($rows === false || $rows->length === 0) {
    // Alternatif selector dene
    $rows = $xpath->query('//div[contains(@class, "table")]//tr');
}

foreach ($rows as $row) {
    $cells = $row->getElementsByTagName('td');
    
    if ($cells->length >= 6) {
        // Hücreleri oku
        $symbol = trim($cells->item(0)->textContent);
        $lastPriceRaw = trim($cells->item(1)->textContent);
        $lowRaw = trim($cells->item(2)->textContent);
        $highRaw = trim($cells->item(3)->textContent);
        $changeRaw = trim($cells->item(4)->textContent);
        $changePctRaw = trim($cells->item(5)->textContent);
        $time = $cells->length >= 7 ? trim($cells->item(6)->textContent) : date('H:i');

        // Sayısal değerleri temizle (Türkçe format: 1.234,56 -> 1234.56)
        $cleanNumber = function($str) {
            $str = preg_replace('/[^\d,.\-]/', '', $str);
            // Türk formatı: nokta binlik, virgül ondalık
            $str = str_replace('.', '', $str);
            $str = str_replace(',', '.', $str);
            return (float)$str;
        };

        $lastPrice = $cleanNumber($lastPriceRaw);
        $low = $cleanNumber($lowRaw);
        $high = $cleanNumber($highRaw);
        $change = $cleanNumber($changeRaw);
        $changePct = $cleanNumber($changePctRaw);

        // Geçerli sembol kontrolü (boş değilse ve sayısal değilse)
        if (!empty($symbol) && !is_numeric($symbol) && $lastPrice > 0) {
            $items[] = [
                'symbol' => strtoupper($symbol),
                'last' => $lastPrice,
                'low' => $low,
                'high' => $high,
                'chg' => $change,
                'chgPct' => $changePct,
                'time' => $time
            ];
        }
    }
}

// Parse başarısız olduysa
if (empty($items)) {
    // Eski cache varsa döndür
    if (file_exists($cache_file)) {
        error_log("BIST100: Failed to parse HTML, returning cached data");
        readfile($cache_file);
        exit;
    }
    http_response_code(502);
    echo json_encode(['error' => 'Failed to parse HTML data', 'updatedAt' => date('c')]);
    exit;
}

// JSON çıktısı
$output = [
    'updatedAt' => date('c'), // ISO 8601 format
    'source' => 'hangikredi',
    'items' => $items
];

// Cache dosyasına yaz
file_put_contents($cache_file, json_encode($output, JSON_UNESCAPED_UNICODE));

echo json_encode($output, JSON_UNESCAPED_UNICODE);
