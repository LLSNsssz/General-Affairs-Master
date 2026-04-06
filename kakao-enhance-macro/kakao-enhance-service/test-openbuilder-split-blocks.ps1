param(
    [string]$BaseUrl = "http://localhost:5088",
    [string]$UserId = "split-user",
    [string]$PlayerName = "분리검",
    [int]$CurrentLevel = 2,
    [int]$TargetLevel = 6
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$uri = $BaseUrl.TrimEnd("/") + "/kakao/openbuilder/skill"

function Invoke-Block {
    param(
        [string]$ActionName,
        [hashtable]$Params,
        [hashtable]$DetailParams
    )

    $payload = @{
        action = @{
            id = "$ActionName-block"
            name = $ActionName
            params = $Params
            detailParams = $DetailParams
        }
        intent = @{
            id = "intent-$ActionName"
            name = $ActionName
        }
        bot = @{
            id = "bot-1"
            name = "enhance-bot"
        }
        userRequest = @{
            utterance = ""
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

$register = Invoke-Block -ActionName "register" -Params @{
    playerName = $PlayerName
    currentLevel = [string]$CurrentLevel
} -DetailParams @{
    playerName = @{
        origin = $PlayerName
        value = $PlayerName
        groupName = ""
    }
    currentLevel = @{
        origin = [string]$CurrentLevel
        value = [string]$CurrentLevel
        groupName = ""
    }
}

$statusBefore = Invoke-Block -ActionName "status" -Params @{} -DetailParams @{}
$enhance = Invoke-Block -ActionName "enhance" -Params @{
    targetLevel = [string]$TargetLevel
} -DetailParams @{
    targetLevel = @{
        origin = [string]$TargetLevel
        value = [string]$TargetLevel
        groupName = ""
    }
}
Start-Sleep -Seconds 4
$statusAfter = Invoke-Block -ActionName "status" -Params @{} -DetailParams @{}

[pscustomobject]@{
    Register = $register.template.outputs[0].simpleText.text
    StatusBefore = $statusBefore.template.outputs[0].simpleText.text
    Enhance = $enhance.template.outputs[0].simpleText.text
    StatusAfter = $statusAfter.template.outputs[0].simpleText.text
} | ConvertTo-Json -Depth 6
