$run = $true
$interval = 330  # 5.30 minutes in seconds
$timeout = 120  # Timeout in seconds

$processId = $null

while ($run) {
    try {
        # Run the Node.js command and capture the processId
        $processId = (Start-Process -FilePath node -ArgumentList "entry.js", "username", "pass" -NoNewWindow -PassThru).ID
        Write-Host "Running Node.js script with ID $processId"


        # Start the stopwatch to track the elapsed time
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

        # Wait for the process to exit or the timeout to occur
        $completed = Wait-Process -Id $processId -Timeout $timeout -ErrorAction SilentlyContinue

        # If the process is still running after the timeout, forcefully terminate it
        if (!$completed) {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            Write-Host "Process with ID $processId was terminated."
        }
    }
    catch {
        # Handle the error if needed
        Write-Host "An error occurred: $_"
    }

    [System.GC]::Collect()  # Optional: Uncomment this line if necessary

    Start-Sleep -Seconds $interval
}
