using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;
using KakaoEnhanceService.Contracts;
using KakaoEnhanceService.Domain;

namespace KakaoEnhanceService.Infrastructure
{
    public sealed class InMemoryStore
    {
        private readonly object _syncRoot = new object();
        private readonly string _storePath;
        private readonly ConcurrentDictionary<string, PlayerState> _players =
            new ConcurrentDictionary<string, PlayerState>(StringComparer.OrdinalIgnoreCase);

        private readonly ConcurrentDictionary<string, EnhanceJob> _jobs =
            new ConcurrentDictionary<string, EnhanceJob>(StringComparer.OrdinalIgnoreCase);

        private readonly BlockingCollection<string> _pendingJobIds =
            new BlockingCollection<string>(new ConcurrentQueue<string>());

        private readonly ConcurrentQueue<DeliveryLog> _deliveryLogs = new ConcurrentQueue<DeliveryLog>();

        public InMemoryStore(string storePath)
        {
            _storePath = storePath;
            LoadSnapshot();
        }

        public IReadOnlyList<PlayerState> GetPlayers()
        {
            return _players.Values
                .OrderBy(player => player.UserId)
                .ThenBy(player => player.PlayerId)
                .ToList();
        }

        public PlayerState GetPlayer(string playerId)
        {
            PlayerState player;
            return !string.IsNullOrWhiteSpace(playerId) && _players.TryGetValue(playerId, out player)
                ? player
                : null;
        }

        public PlayerState FindFirstPlayerByUser(string userId)
        {
            return _players.Values
                .Where(player => string.Equals(player.UserId, userId, StringComparison.OrdinalIgnoreCase))
                .OrderBy(player => player.PlayerId)
                .FirstOrDefault();
        }

        public PlayerState UpsertPlayer(PlayerState player)
        {
            player.LastUpdatedUtc = DateTime.UtcNow;
            var saved = _players.AddOrUpdate(
                player.PlayerId,
                player,
                (_, existing) =>
                {
                    existing.UserId = player.UserId;
                    existing.DisplayName = player.DisplayName;
                    existing.CurrentLevel = player.CurrentLevel;
                    existing.LastUpdatedUtc = player.LastUpdatedUtc;
                    return existing;
                });
            PersistSnapshot();
            return saved;
        }

        public EnhanceJob EnqueueJob(EnhanceRequest request)
        {
            var job = new EnhanceJob
            {
                Id = Guid.NewGuid().ToString("N"),
                UserId = request.UserId,
                PlayerId = request.PlayerId,
                TargetLevel = request.TargetLevel,
                RequestedBy = string.IsNullOrWhiteSpace(request.RequestedBy) ? request.UserId : request.RequestedBy,
                Source = string.IsNullOrWhiteSpace(request.Source) ? "manual" : request.Source,
                Status = "queued",
                LastMessage = "작업 큐에 등록되었습니다.",
                CreatedUtc = DateTime.UtcNow
            };

            _jobs[job.Id] = job;
            _pendingJobIds.Add(job.Id);
            PersistSnapshot();
            return job;
        }

        public EnhanceJob GetJob(string jobId)
        {
            EnhanceJob job;
            return !string.IsNullOrWhiteSpace(jobId) && _jobs.TryGetValue(jobId, out job)
                ? job
                : null;
        }

        public IReadOnlyList<EnhanceJob> GetJobs()
        {
            return _jobs.Values
                .OrderByDescending(job => job.CreatedUtc)
                .ToList();
        }

        public bool TryTakePendingJob(out string jobId, int timeoutMilliseconds)
        {
            return _pendingJobIds.TryTake(out jobId, timeoutMilliseconds);
        }

        public void SaveJob(EnhanceJob job)
        {
            _jobs[job.Id] = job;
            PersistSnapshot();
        }

        public void AddDeliveryLog(DeliveryLog log)
        {
            _deliveryLogs.Enqueue(log);

            while (_deliveryLogs.Count > 100)
            {
                DeliveryLog ignored;
                _deliveryLogs.TryDequeue(out ignored);
            }

            PersistSnapshot();
        }

        public IReadOnlyList<DeliveryLog> GetDeliveryLogs()
        {
            return _deliveryLogs
                .OrderByDescending(log => log.CreatedUtc)
                .ToList();
        }

        private void LoadSnapshot()
        {
            if (string.IsNullOrWhiteSpace(_storePath))
            {
                return;
            }

            if (!File.Exists(_storePath))
            {
                var directory = Path.GetDirectoryName(_storePath);
                if (!string.IsNullOrWhiteSpace(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                return;
            }

            var json = File.ReadAllText(_storePath);
            if (string.IsNullOrWhiteSpace(json))
            {
                return;
            }

            var serializer = new JavaScriptSerializer();
            var snapshot = serializer.Deserialize<StoreSnapshot>(json);
            if (snapshot == null)
            {
                return;
            }

            if (snapshot.Players != null)
            {
                foreach (var player in snapshot.Players)
                {
                    if (player == null || string.IsNullOrWhiteSpace(player.PlayerId))
                    {
                        continue;
                    }

                    _players[player.PlayerId] = player;
                }
            }

            if (snapshot.Jobs != null)
            {
                foreach (var job in snapshot.Jobs.OrderBy(job => job.CreatedUtc))
                {
                    if (job == null || string.IsNullOrWhiteSpace(job.Id))
                    {
                        continue;
                    }

                    if (job.Attempts == null)
                    {
                        job.Attempts = new List<EnhanceAttempt>();
                    }

                    if (string.Equals(job.Status, "queued", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(job.Status, "running", StringComparison.OrdinalIgnoreCase))
                    {
                        job.Status = "queued";
                        job.StartedUtc = null;
                        job.CompletedUtc = null;
                        job.LastMessage = "서비스 재시작 후 대기열에 복구되었습니다.";
                        _pendingJobIds.Add(job.Id);
                    }

                    _jobs[job.Id] = job;
                }
            }

            if (snapshot.DeliveryLogs != null)
            {
                foreach (var log in snapshot.DeliveryLogs.OrderBy(log => log.CreatedUtc))
                {
                    if (log == null || string.IsNullOrWhiteSpace(log.Id))
                    {
                        continue;
                    }

                    _deliveryLogs.Enqueue(log);
                }
            }
        }

        private void PersistSnapshot()
        {
            if (string.IsNullOrWhiteSpace(_storePath))
            {
                return;
            }

            lock (_syncRoot)
            {
                var directory = Path.GetDirectoryName(_storePath);
                if (!string.IsNullOrWhiteSpace(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                var snapshot = new StoreSnapshot
                {
                    Players = _players.Values
                        .OrderBy(player => player.UserId)
                        .ThenBy(player => player.PlayerId)
                        .ToList(),
                    Jobs = _jobs.Values
                        .OrderBy(job => job.CreatedUtc)
                        .ToList(),
                    DeliveryLogs = _deliveryLogs
                        .OrderBy(log => log.CreatedUtc)
                        .ToList()
                };

                var serializer = new JavaScriptSerializer();
                var json = serializer.Serialize(snapshot);
                File.WriteAllText(_storePath, json);
            }
        }
    }
}
