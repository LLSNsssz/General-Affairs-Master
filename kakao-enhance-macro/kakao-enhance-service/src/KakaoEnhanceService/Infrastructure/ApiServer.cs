using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Threading;
using KakaoEnhanceService.Contracts;
using KakaoEnhanceService.Domain;
using KakaoEnhanceService.Services;

namespace KakaoEnhanceService.Infrastructure
{
    public sealed class ApiServer : IDisposable
    {
        private sealed class CommandExecutionResult
        {
            public string ReplyText { get; set; }

            public object[] QuickReplies { get; set; }
        }

        private readonly string _prefix;
        private readonly InMemoryStore _store;
        private readonly CommandParser _parser;
        private readonly HttpListener _listener;
        private readonly string _uiRoot;
        private volatile bool _stopping;

        public ApiServer(string prefix, InMemoryStore store, CommandParser parser)
        {
            _prefix = prefix.EndsWith("/") ? prefix : prefix + "/";
            _store = store;
            _parser = parser;
            _uiRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui");
            _listener = new HttpListener();
            _listener.Prefixes.Add(_prefix);
        }

        public void Run()
        {
            Console.CancelKeyPress += OnCancelKeyPress;
            _listener.Start();

            Console.WriteLine("Kakao Enhance Service");
            Console.WriteLine("Listening on " + _prefix);
            Console.WriteLine("GET  /health");
            Console.WriteLine("GET  /players");
            Console.WriteLine("POST /players/{playerId}");
            Console.WriteLine("POST /commands/enhance");
            Console.WriteLine("POST /kakao/channel/webhook");
            Console.WriteLine("Press Ctrl+C to stop.");

            while (!_stopping)
            {
                HttpListenerContext context;
                try
                {
                    context = _listener.GetContext();
                }
                catch (HttpListenerException)
                {
                    if (_stopping)
                    {
                        break;
                    }

                    throw;
                }
                catch (ObjectDisposedException)
                {
                    if (_stopping)
                    {
                        break;
                    }

                    throw;
                }

                ThreadPool.QueueUserWorkItem(_ => Handle(context));
            }
        }

        public void Dispose()
        {
            _stopping = true;
            _listener.Close();
            Console.CancelKeyPress -= OnCancelKeyPress;
        }

        private void OnCancelKeyPress(object sender, ConsoleCancelEventArgs e)
        {
            e.Cancel = true;
            _stopping = true;
            _listener.Stop();
        }

        private void Handle(HttpListenerContext context)
        {
            try
            {
                var request = context.Request;
                var method = request.HttpMethod.ToUpperInvariant();
                var path = request.Url.AbsolutePath.TrimEnd('/');

                if (path == string.Empty)
                {
                    path = "/";
                }

                if (method == "GET" && path == "/app")
                {
                    WriteUi(context.Response, "index.html");
                    return;
                }

                if (method == "GET" && path.StartsWith("/app/", StringComparison.OrdinalIgnoreCase))
                {
                    WriteUi(context.Response, path.Substring("/app/".Length));
                    return;
                }

                if (method == "GET" && path == "/")
                {
                    if (WantsHtml(request))
                    {
                        WriteUi(context.Response, "index.html");
                        return;
                    }

                    JsonUtil.WriteJson(context.Response, 200, new
                    {
                        service = "kakao-enhance-service",
                        status = "ok",
                        message = "service is running",
                        app = "/app",
                        endpoints = new[]
                        {
                            "GET /",
                            "GET /app",
                            "GET /health",
                            "GET /players",
                            "GET /players/{playerId}",
                            "POST /players/{playerId}",
                            "GET /jobs",
                            "GET /jobs/{jobId}",
                            "POST /commands/enhance",
                            "POST /kakao/channel/webhook",
                            "POST /kakao/openbuilder/skill",
                            "GET /delivery-logs"
                        },
                        examples = new
                        {
                            registerPlayer = new
                            {
                                method = "POST",
                                path = "/players/sword-main",
                                body = new
                                {
                                    userId = "demo-user",
                                    displayName = "은둔의 싹 검",
                                    currentLevel = 1
                                }
                            },
                            webhook = new
                            {
                                method = "POST",
                                path = "/kakao/channel/webhook",
                                body = new
                                {
                                    userId = "demo-user",
                                    message = "강화 19"
                                }
                            },
                            openBuilderSkill = new
                            {
                                method = "POST",
                                path = "/kakao/openbuilder/skill",
                                body = new
                                {
                                    action = new
                                    {
                                        name = "enhance",
                                        @params = new
                                        {
                                            targetLevel = "19"
                                        }
                                    },
                                    userRequest = new
                                    {
                                        utterance = "강화 19",
                                        user = new
                                        {
                                            id = "demo-user",
                                            properties = new
                                            {
                                                botUserKey = "demo-user"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                    return;
                }

                if (method == "GET" && path == "/health")
                {
                    JsonUtil.WriteJson(context.Response, 200, new
                    {
                        status = "ok",
                        service = "kakao-enhance-service",
                        nowUtc = DateTime.UtcNow.ToString("o")
                    });
                    return;
                }

                if (method == "GET" && path == "/players")
                {
                    JsonUtil.WriteJson(context.Response, 200, _store.GetPlayers());
                    return;
                }

                if (method == "GET" && path == "/jobs")
                {
                    JsonUtil.WriteJson(context.Response, 200, _store.GetJobs());
                    return;
                }

                if (method == "GET" && path == "/delivery-logs")
                {
                    JsonUtil.WriteJson(context.Response, 200, _store.GetDeliveryLogs());
                    return;
                }

                if (path.StartsWith("/players/", StringComparison.OrdinalIgnoreCase))
                {
                    var playerId = DecodePathSegment(path.Substring("/players/".Length));
                    HandlePlayer(context, method, playerId);
                    return;
                }

                if (path.StartsWith("/jobs/", StringComparison.OrdinalIgnoreCase))
                {
                    var jobId = DecodePathSegment(path.Substring("/jobs/".Length));
                    HandleJob(context, jobId);
                    return;
                }

                if (method == "POST" && path == "/commands/enhance")
                {
                    HandleEnhanceCommand(context);
                    return;
                }

                if (method == "POST" && path == "/kakao/channel/webhook")
                {
                    HandleChannelWebhook(context);
                    return;
                }

                if (method == "POST" && path == "/kakao/openbuilder/skill")
                {
                    HandleOpenBuilderSkill(context);
                    return;
                }

                JsonUtil.WriteJson(context.Response, 404, new
                {
                    error = "not_found",
                    message = "지원하지 않는 경로입니다."
                });
            }
            catch (Exception ex)
            {
                JsonUtil.WriteJson(context.Response, 500, new
                {
                    error = "server_error",
                    message = ex.Message
                });
            }
        }

        private void HandlePlayer(HttpListenerContext context, string method, string playerId)
        {
            if (method == "GET")
            {
                var player = _store.GetPlayer(playerId);
                if (player == null)
                {
                    JsonUtil.WriteJson(context.Response, 404, new
                    {
                        error = "player_not_found",
                        playerId = playerId
                    });
                    return;
                }

                JsonUtil.WriteJson(context.Response, 200, player);
                return;
            }

            if (method == "POST")
            {
                var requestBody = JsonUtil.ReadBody(context.Request);
                var payload = JsonUtil.Deserialize<UpsertPlayerRequest>(requestBody) ?? new UpsertPlayerRequest();

                if (payload.CurrentLevel < 0)
                {
                    JsonUtil.WriteJson(context.Response, 400, new
                    {
                        error = "invalid_level",
                        message = "currentLevel must be >= 0"
                    });
                    return;
                }

                var player = _store.UpsertPlayer(new PlayerState
                {
                    PlayerId = playerId,
                    UserId = string.IsNullOrWhiteSpace(payload.UserId) ? "anonymous" : payload.UserId,
                    DisplayName = string.IsNullOrWhiteSpace(payload.DisplayName) ? playerId : payload.DisplayName,
                    CurrentLevel = payload.CurrentLevel
                });

                JsonUtil.WriteJson(context.Response, 200, new
                {
                    message = "player_saved",
                    player = player
                });
                return;
            }

            JsonUtil.WriteJson(context.Response, 405, new
            {
                error = "method_not_allowed"
            });
        }

        private void HandleJob(HttpListenerContext context, string jobId)
        {
            var job = _store.GetJob(jobId);
            if (job == null)
            {
                JsonUtil.WriteJson(context.Response, 404, new
                {
                    error = "job_not_found",
                    jobId = jobId
                });
                return;
            }

            JsonUtil.WriteJson(context.Response, 200, job);
        }

        private void HandleEnhanceCommand(HttpListenerContext context)
        {
            var requestBody = JsonUtil.ReadBody(context.Request);
            var payload = JsonUtil.Deserialize<EnhanceRequest>(requestBody);

            if (payload == null ||
                string.IsNullOrWhiteSpace(payload.PlayerId) ||
                payload.TargetLevel <= 0)
            {
                JsonUtil.WriteJson(context.Response, 400, new
                {
                    error = "invalid_request",
                    message = "playerId and targetLevel are required."
                });
                return;
            }

            var player = _store.GetPlayer(payload.PlayerId);
            if (player == null)
            {
                JsonUtil.WriteJson(context.Response, 404, new
                {
                    error = "player_not_found",
                    playerId = payload.PlayerId
                });
                return;
            }

            var job = _store.EnqueueJob(payload);
            JsonUtil.WriteJson(context.Response, 202, new
            {
                message = "enhance_job_queued",
                jobId = job.Id,
                currentLevel = player.CurrentLevel,
                targetLevel = job.TargetLevel
            });
        }

        private void HandleChannelWebhook(HttpListenerContext context)
        {
            var requestBody = JsonUtil.ReadBody(context.Request);
            if (LooksLikeOpenBuilderPayload(requestBody))
            {
                HandleOpenBuilderSkill(context, requestBody);
                return;
            }

            var payload = JsonUtil.Deserialize<KakaoWebhookRequest>(requestBody);

            if (payload == null || string.IsNullOrWhiteSpace(payload.UserId))
            {
                JsonUtil.WriteJson(context.Response, 400, new
                {
                    error = "invalid_request",
                    message = "userId is required."
                });
                return;
            }

            var result = ExecuteTextCommand(
                payload.UserId,
                payload.PlayerId,
                payload.Message,
                "kakao-channel");

            JsonUtil.WriteJson(context.Response, 200, new
            {
                replyText = result.ReplyText
            });
        }

        private void HandleOpenBuilderSkill(HttpListenerContext context)
        {
            HandleOpenBuilderSkill(context, JsonUtil.ReadBody(context.Request));
        }

        private void HandleOpenBuilderSkill(HttpListenerContext context, string requestBody)
        {
            var payload = JsonUtil.Deserialize<OpenBuilderSkillRequest>(requestBody);

            if (payload == null)
            {
                JsonUtil.WriteJson(context.Response, 400, BuildOpenBuilderTextResponse(
                    "요청 본문을 읽지 못했습니다.",
                    BuildQuickReply("도움말", "도움말")));
                return;
            }

            var userId = ResolveOpenBuilderUserId(payload);
            var message = ResolveOpenBuilderMessage(payload);
            var playerId = ResolveOpenBuilderPlayerId(payload);
            var result = ExecuteTextCommand(userId, playerId, message, "openbuilder-skill");

            JsonUtil.WriteJson(context.Response, 200, BuildOpenBuilderTextResponse(
                result.ReplyText,
                result.QuickReplies ?? new object[0]));
        }

        private PlayerState ResolvePlayer(KakaoWebhookRequest payload)
        {
            if (!string.IsNullOrWhiteSpace(payload.PlayerId))
            {
                var explicitPlayer = _store.GetPlayer(payload.PlayerId);
                if (explicitPlayer != null)
                {
                    return explicitPlayer;
                }
            }

            return _store.FindFirstPlayerByUser(payload.UserId);
        }

        private CommandExecutionResult ExecuteTextCommand(
            string userId,
            string explicitPlayerId,
            string message,
            string source)
        {
            var normalizedUserId = string.IsNullOrWhiteSpace(userId) ? "anonymous" : userId;
            var command = _parser.Parse(message);

            switch (command.Kind)
            {
                case CommandKind.Help:
                    return new CommandExecutionResult
                    {
                        ReplyText = "사용법: 등록 {이름} {현재레벨}, 상태, 강화 {목표레벨}",
                        QuickReplies = new object[]
                        {
                            BuildQuickReply("상태", "상태"),
                            BuildQuickReply("강화 19", "강화 19")
                        }
                    };

                case CommandKind.Register:
                    var registeredPlayer = _store.UpsertPlayer(new PlayerState
                    {
                        PlayerId = command.PlayerName,
                        UserId = normalizedUserId,
                        DisplayName = command.PlayerName,
                        CurrentLevel = command.CurrentLevel ?? 0
                    });

                    return new CommandExecutionResult
                    {
                        ReplyText = string.Format(
                            "{0} 등록 완료. 현재 강화 수치는 {1}입니다.",
                            registeredPlayer.DisplayName,
                            registeredPlayer.CurrentLevel),
                        QuickReplies = new object[]
                        {
                            BuildQuickReply("상태", "상태"),
                            BuildQuickReply("강화 " + Math.Max(registeredPlayer.CurrentLevel + 1, 2), "강화 " + Math.Max(registeredPlayer.CurrentLevel + 1, 2))
                        }
                    };

                case CommandKind.Status:
                    var statusPlayer = ResolvePlayer(normalizedUserId, explicitPlayerId);
                    if (statusPlayer == null)
                    {
                        return new CommandExecutionResult
                        {
                            ReplyText = "등록된 플레이어가 없습니다. 예: 등록 검 1",
                            QuickReplies = new object[]
                            {
                                BuildQuickReply("등록 검 1", "등록 검 1"),
                                BuildQuickReply("도움말", "도움말")
                            }
                        };
                    }

                    return new CommandExecutionResult
                    {
                        ReplyText = string.Format(
                            "{0}의 현재 강화 수치는 {1}입니다.",
                            statusPlayer.DisplayName,
                            statusPlayer.CurrentLevel),
                        QuickReplies = new object[]
                        {
                            BuildQuickReply("강화 " + (statusPlayer.CurrentLevel + 1), "강화 " + (statusPlayer.CurrentLevel + 1)),
                            BuildQuickReply("강화 19", "강화 19")
                        }
                    };

                case CommandKind.Enhance:
                    var enhancePlayer = ResolvePlayer(normalizedUserId, explicitPlayerId);
                    if (enhancePlayer == null)
                    {
                        return new CommandExecutionResult
                        {
                            ReplyText = "강화할 플레이어가 없습니다. 먼저 등록하세요. 예: 등록 검 1",
                            QuickReplies = new object[]
                            {
                                BuildQuickReply("등록 검 1", "등록 검 1"),
                                BuildQuickReply("도움말", "도움말")
                            }
                        };
                    }

                    var targetLevel = command.TargetLevel ?? enhancePlayer.CurrentLevel;
                    var job = _store.EnqueueJob(new EnhanceRequest
                    {
                        UserId = normalizedUserId,
                        PlayerId = enhancePlayer.PlayerId,
                        TargetLevel = targetLevel,
                        RequestedBy = normalizedUserId,
                        Source = source
                    });

                    return new CommandExecutionResult
                    {
                        ReplyText = string.Format(
                            "{0} 강화 요청을 접수했습니다. 현재 {1}, 목표 {2}, 작업 ID {3}",
                            enhancePlayer.DisplayName,
                            enhancePlayer.CurrentLevel,
                            job.TargetLevel,
                            job.Id),
                        QuickReplies = new object[]
                        {
                            BuildQuickReply("상태", "상태"),
                            BuildQuickReply("강화 " + (job.TargetLevel + 1), "강화 " + (job.TargetLevel + 1))
                        }
                    };

                default:
                    return new CommandExecutionResult
                    {
                        ReplyText = "알 수 없는 명령입니다. 도움말 을 입력하세요.",
                        QuickReplies = new object[]
                        {
                            BuildQuickReply("도움말", "도움말"),
                            BuildQuickReply("상태", "상태")
                        }
                    };
            }
        }

        private PlayerState ResolvePlayer(string userId, string explicitPlayerId)
        {
            if (!string.IsNullOrWhiteSpace(explicitPlayerId))
            {
                var explicitPlayer = _store.GetPlayer(explicitPlayerId);
                if (explicitPlayer != null)
                {
                    return explicitPlayer;
                }
            }

            return _store.FindFirstPlayerByUser(userId);
        }

        private static string DecodePathSegment(string value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? value
                : Uri.UnescapeDataString(value);
        }

        private static bool LooksLikeOpenBuilderPayload(string requestBody)
        {
            return !string.IsNullOrWhiteSpace(requestBody) &&
                requestBody.IndexOf("\"userRequest\"", StringComparison.OrdinalIgnoreCase) >= 0 &&
                requestBody.IndexOf("\"action\"", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private string ResolveOpenBuilderUserId(OpenBuilderSkillRequest payload)
        {
            if (payload != null &&
                payload.UserRequest != null &&
                payload.UserRequest.User != null &&
                !string.IsNullOrWhiteSpace(payload.UserRequest.User.Id))
            {
                return payload.UserRequest.User.Id;
            }

            Dictionary<string, string> properties = null;
            if (payload != null &&
                payload.UserRequest != null &&
                payload.UserRequest.User != null)
            {
                properties = payload.UserRequest.User.Properties;
            }

            if (properties != null)
            {
                foreach (var key in new[] { "botUserKey", "plusfriendUserKey", "appUserId" })
                {
                    string value;
                    if (properties.TryGetValue(key, out value) && !string.IsNullOrWhiteSpace(value))
                    {
                        return value;
                    }
                }
            }

            return "anonymous";
        }

        private string ResolveOpenBuilderPlayerId(OpenBuilderSkillRequest payload)
        {
            return GetOpenBuilderParam(payload, "playerId") ??
                GetOpenBuilderParam(payload, "player") ??
                GetOpenBuilderParam(payload, "weaponId");
        }

        private string ResolveOpenBuilderMessage(OpenBuilderSkillRequest payload)
        {
            var utterance = payload != null && payload.UserRequest != null
                ? payload.UserRequest.Utterance
                : null;

            if (!string.IsNullOrWhiteSpace(utterance))
            {
                return utterance;
            }

            var actionName = payload != null && payload.Action != null && payload.Action.Name != null
                ? payload.Action.Name
                : string.Empty;
            var targetLevel = GetOpenBuilderParam(payload, "targetLevel") ??
                GetOpenBuilderParam(payload, "level");
            var playerName = GetOpenBuilderParam(payload, "playerName") ??
                GetOpenBuilderParam(payload, "name");
            var currentLevel = GetOpenBuilderParam(payload, "currentLevel");

            if ((actionName.IndexOf("register", StringComparison.OrdinalIgnoreCase) >= 0 ||
                actionName.IndexOf("등록", StringComparison.OrdinalIgnoreCase) >= 0) &&
                !string.IsNullOrWhiteSpace(playerName) &&
                !string.IsNullOrWhiteSpace(currentLevel))
            {
                return string.Format("등록 {0} {1}", playerName, currentLevel);
            }

            if ((actionName.IndexOf("enhance", StringComparison.OrdinalIgnoreCase) >= 0 ||
                actionName.IndexOf("강화", StringComparison.OrdinalIgnoreCase) >= 0) &&
                !string.IsNullOrWhiteSpace(targetLevel))
            {
                return "강화 " + targetLevel;
            }

            if (actionName.IndexOf("status", StringComparison.OrdinalIgnoreCase) >= 0 ||
                actionName.IndexOf("상태", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return "상태";
            }

            return string.Empty;
        }

        private static string GetOpenBuilderParam(OpenBuilderSkillRequest payload, string key)
        {
            if (payload != null &&
                payload.Action != null &&
                payload.Action.Params != null)
            {
                foreach (var pair in payload.Action.Params)
                {
                    if (string.Equals(pair.Key, key, StringComparison.OrdinalIgnoreCase))
                    {
                        return pair.Value;
                    }
                }
            }

            if (payload != null &&
                payload.Action != null &&
                payload.Action.DetailParams != null)
            {
                foreach (var pair in payload.Action.DetailParams)
                {
                    if (string.Equals(pair.Key, key, StringComparison.OrdinalIgnoreCase))
                    {
                        return pair.Value != null ? pair.Value.Value : null;
                    }
                }
            }

            return null;
        }

        private static object BuildQuickReply(string label, string messageText)
        {
            return new
            {
                action = "message",
                label = label,
                messageText = messageText
            };
        }

        private static object BuildOpenBuilderTextResponse(string replyText, params object[] quickReplies)
        {
            return new
            {
                version = "2.0",
                template = new
                {
                    outputs = new object[]
                    {
                        new
                        {
                            simpleText = new
                            {
                                text = replyText
                            }
                        }
                    },
                    quickReplies = quickReplies ?? new object[0]
                }
            };
        }

        private void WriteUi(HttpListenerResponse response, string relativePath)
        {
            var cleaned = (relativePath ?? string.Empty)
                .Replace('/', Path.DirectorySeparatorChar)
                .TrimStart(Path.DirectorySeparatorChar);

            if (string.IsNullOrWhiteSpace(cleaned))
            {
                cleaned = "index.html";
            }

            var fullPath = Path.GetFullPath(Path.Combine(_uiRoot, cleaned));
            var rootPath = Path.GetFullPath(_uiRoot + Path.DirectorySeparatorChar);

            if (!fullPath.StartsWith(rootPath, StringComparison.OrdinalIgnoreCase))
            {
                JsonUtil.WriteJson(response, 403, new
                {
                    error = "forbidden"
                });
                return;
            }

            if (!StaticFileHelper.TryWriteFile(response, fullPath))
            {
                JsonUtil.WriteJson(response, 404, new
                {
                    error = "asset_not_found",
                    path = cleaned
                });
            }
        }

        private static bool WantsHtml(HttpListenerRequest request)
        {
            var acceptTypes = request.AcceptTypes;
            if (acceptTypes == null)
            {
                return false;
            }

            foreach (var acceptType in acceptTypes)
            {
                if (string.IsNullOrWhiteSpace(acceptType))
                {
                    continue;
                }

                if (acceptType.IndexOf("text/html", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return true;
                }
            }

            return false;
        }
    }
}
