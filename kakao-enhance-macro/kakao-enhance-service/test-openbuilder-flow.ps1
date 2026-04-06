param(
    [string]$BaseUrl = "http://localhost:5088",
    [string]$UserId = "flow-user",
    [string]$PlayerName = "",
    [int]$CurrentLevel = 3,
    [int]$TargetLevel = 7
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-Word {
    param(
        [int[]]$CodePoints
    )

    return -join ($CodePoints | ForEach-Object { [char]$_ })
}

$registerWord = Get-Word 0xB4F1, 0xB85D
$statusWord = Get-Word 0xC0C1, 0xD0DC
$enhanceWord = Get-Word 0xAC15, 0xD654
$defaultPlayerName = Get-Word 0xC2E4, 0xC804, 0xAC80

if ([string]::IsNullOrWhiteSpace($PlayerName)) {
    $PlayerName = $defaultPlayerName
}

$uri = $BaseUrl.TrimEnd("/") + "/kakao/openbuilder/skill"

function Invoke-Skill {
    param(
        [string]$Utterance
    )

    $payload = @{
        action = @{
            id = "flow-skill"
            name = "main"
            params = @{}
            detailParams = @{}
        }
        intent = @{
            id = "intent-flow"
            name = "main"
        }
        bot = @{
            id = "bot-1"
            name = "enhance-bot"
        }
        userRequest = @{
            utterance = $Utterance
            user = @{
                id = $UserId
                type = "aiin"
                properties = @{
                    botUserKey = $UserId
                }
            }
        }
    } | ConvertTo-Json -Depth 8

    Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json; charset=utf-8" -Body $payload
}

$registerReply = Invoke-Skill -Utterance ("{0} {1} {2}" -f $registerWord, $PlayerName, $CurrentLevel)
$statusBefore = Invoke-Skill -Utterance $statusWord
$enhanceReply = Invoke-Skill -Utterance ("{0} {1}" -f $enhanceWord, $TargetLevel)
Start-Sleep -Seconds 4
$statusAfter = Invoke-Skill -Utterance $statusWord

[pscustomobject]@{
    Register = $registerReply.template.outputs[0].simpleText.text
    StatusBefore = $statusBefore.template.outputs[0].simpleText.text
    Enhance = $enhanceReply.template.outputs[0].simpleText.text
    StatusAfter = $statusAfter.template.outputs[0].simpleText.text
} | ConvertTo-Json -Depth 6
