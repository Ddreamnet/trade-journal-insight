

# Plan: Kıyaslama Grafiğini Dikey Sütunlara Çevirme

## Mevcut Durum

Şu an `layout="vertical"` kullanılıyor, bu yatay bar'lar oluşturuyor (soldan sağa uzanan).

## İstenen Değişiklik

Klasik dikey sütun grafiği (aşağıdan yukarı uzanan bar'lar).

---

## Değişiklikler

### Dosya: `src/components/reports/ReturnComparisonChart.tsx`

| Satır | Değişiklik |
|-------|------------|
| 76-113 | `BarValueLabel` fonksiyonu güncelle - dikey sütun için bar üstüne label |
| 302-307 | Scroll container: minWidth hesaplaması güncelle |
| 309-352 | BarChart: `layout` prop'u kaldır, eksenleri değiştir |

#### 1. BarValueLabel Güncellemesi (satır 76-113)

Dikey sütunlarda label bar'ın üstünde olmalı:

```typescript
function BarValueLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number;
}) {
  const { x, y, width, value } = props;
  
  if (
    value === undefined ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number'
  ) {
    return null;
  }
  
  const isPositive = value >= 0;
  // Dikey sütun için: bar'ın üstüne (pozitif) veya altına (negatif)
  const labelX = x + width / 2;
  const labelY = isPositive ? (y as number) - 6 : (y as number) + 16;

  return (
    <text
      x={labelX}
      y={labelY}
      fill={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
      fontSize={11}
      fontFamily="JetBrains Mono, monospace"
      fontWeight={600}
      dominantBaseline="middle"
      textAnchor="middle"
    >
      {isPositive ? '+' : ''}{value.toFixed(1)}%
    </text>
  );
}
```

#### 2. Scroll Container Güncellemesi (satır 302-307)

Dikey sütunlar için yatay scroll hesaplaması:

```typescript
<div
  style={{
    minWidth: needsScroll ? returnData.length * 80 : 'auto',
  }}
>
```

#### 3. BarChart Güncellemesi (satır 309-352)

`layout="vertical"` kaldırılacak ve eksenler yer değiştirecek:

```typescript
<ResponsiveContainer width="100%" height={chartHeight}>
  <BarChart
    data={returnData}
    margin={{ top: 25, right: 10, left: 10, bottom: 5 }}
  >
    {/* X ekseni: Varlık isimleri (kategori) */}
    <XAxis
      type="category"
      dataKey="name"
      stroke="hsl(var(--muted-foreground))"
      fontSize={11}
      tickLine={false}
    />
    {/* Y ekseni: Yüzde değerleri (sayısal) */}
    <YAxis
      type="number"
      domain={['auto', 'auto']}
      stroke="hsl(var(--muted-foreground))"
      fontSize={11}
      tickLine={false}
      tickFormatter={(value: number) => `${value}%`}
    />
    <Tooltip content={<BarTooltip />} />
    <ReferenceLine
      y={0}
      stroke="hsl(var(--muted-foreground))"
      strokeDasharray="3 3"
    />
    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
      {returnData.map((entry) => (
        <Cell key={entry.id} fill={entry.color} />
      ))}
      <LabelList
        dataKey="value"
        content={(props) => <BarValueLabel {...props} />}
      />
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

---

## Görsel Değişiklik

```text
ÖNCE (Yatay):                      SONRA (Dikey):
                                   
Portföy  ████████│ +8.2%              +12%  +8%  +5%  -2%
  Altın  ██████│ +5.1%                 ▓▓    ▓▓   ▓▓   
  Dolar  █│ -2.3%                      ▓▓    ▓▓   ▓▓   ▓▓
BIST100  ██████████████│ +12%          ▓▓    ▓▓   ▓▓   ▓▓
         ──────0──────              ───────────0────────
                                   Portföy Altın Dolar BIST
```

---

## Teknik Notlar

- `layout` prop kaldırıldığında varsayılan olarak dikey sütun grafiği olur
- `ReferenceLine`: `x={0}` → `y={0}` olacak (yatay 0 çizgisi)
- Bar `radius`: `[0, 4, 4, 0]` → `[4, 4, 0, 0]` (üst köşeler yuvarlanacak)
- `barSize`: 24 → 40 (dikey sütunlar için daha geniş)
- Label: bar üstüne ortalanmış şekilde

