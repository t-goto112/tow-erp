# Load .env.local
$content = Get-Content .env.local
$env = @{}
foreach ($line in $content) {
    if ($line -match "^\s*([\w.-]+)\s*=\s*(.*)?\s*$") {
        $key = $matches[1]
        $value = $matches[2].Trim()
        if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
        $env[$key] = $value
    }
}

$url = $env["NEXT_PUBLIC_SUPABASE_URL"]
$key = $env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

if (-not $url -or -not $key) {
    Write-Error "Missing Supabase URL or Key"
    exit 1
}

$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

# 1. Create a dummy order
$orderBody = @{
    order_number = "DEBUG-$(Get-Date -Format 'yyyyMMddHHmmss')"
    customer_name = "PowerShell Debug"
    channel = "wholesale"
    status = "pending"
} | ConvertTo-Json

Write-Host "Creating test order..."
try {
    $orderResponse = Invoke-RestMethod -Uri "$url/rest/v1/orders" -Method Post -Headers $headers -Body $orderBody
    $orderId = $orderResponse[0].id
    Write-Host "Order created: $orderId"

    # 2. Get a product ID
    Write-Host "Fetching a product ID..."
    $productResponse = Invoke-RestMethod -Uri "$url/rest/v1/products?limit=1" -Method Get -Headers $headers
    if ($productResponse.Count -eq 0) {
        Write-Error "No products found"
        exit 1
    }
    $productId = $productResponse[0].id

    # 3. Test order_items insertion
    $itemBody = @{
        order_id = $orderId
        product_id = $productId
        quantity = 1
        unit_price = 100
        shipped_quantity = 0
    } | ConvertTo-Json

    Write-Host "Testing order_items insert with shipped_quantity..."
    $itemResponse = Invoke-WebRequest -Uri "$url/rest/v1/order_items" -Method Post -Headers $headers -Body $itemBody
    Write-Host "Status: $($itemResponse.StatusCode)"
    Write-Host "Body: $($itemResponse.Content)"

} catch {
    Write-Error $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Host "Error Details: $($_.ErrorDetails.Message)"
    }
    # Check if we have the JSON response
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $respBody = $reader.ReadToEnd()
        Write-Host "API Error Response: $respBody"
    }
} finally {
    if ($orderId) {
        Write-Host "Cleaning up test order..."
        Invoke-RestMethod -Uri "$url/rest/v1/orders?id=eq.$orderId" -Method Delete -Headers $headers
    }
}
