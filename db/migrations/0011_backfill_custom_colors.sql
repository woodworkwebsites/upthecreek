UPDATE products
SET custom_colors = colors,
    updated_at = datetime('now')
WHERE COALESCE(custom_colors, '[]') = '[]'
  AND COALESCE(colors, '[]') <> '[]';
