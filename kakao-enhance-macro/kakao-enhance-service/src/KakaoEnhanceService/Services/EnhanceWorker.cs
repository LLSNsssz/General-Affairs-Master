using System;
using System.Threading;
using KakaoEnhanceService.Domain;
using KakaoEnhanceService.Infrastructure;

namespace KakaoEnhanceService.Services
{
    public sealed class EnhanceWorker : IDisposable
    {
        private readonly InMemoryStore _store;
        private volatile bool _stopping;
        private Thread _thread;

        public EnhanceWorker(InMemoryStore store)
        {
            _store = store;
        }

        public void Start()
        {
            _thread = new Thread(Run)
            {
                IsBackground = true,
                Name = "EnhanceWorker"
            };

            _thread.Start();
        }

        public void Dispose()
        {
            _stopping = true;

            if (_thread != null && _thread.IsAlive)
            {
                _thread.Join(1000);
            }
        }

        private void Run()
        {
            while (!_stopping)
            {
                string jobId;
                if (!_store.TryTakePendingJob(out jobId, 500))
                {
                    continue;
                }

                ProcessJob(jobId);
            }
        }

        private void ProcessJob(string jobId)
        {
            var job = _store.GetJob(jobId);
            if (job == null)
            {
                return;
            }

            var player = _store.GetPlayer(job.PlayerId);
            if (player == null)
            {
                job.Status = "failed";
                job.CompletedUtc = DateTime.UtcNow;
                job.LastMessage = "대상 플레이어를 찾지 못했습니다.";
                _store.SaveJob(job);
                return;
            }

            job.Status = "running";
            job.StartedUtc = DateTime.UtcNow;
            job.LastMessage = "강화 작업을 시작했습니다.";
            _store.SaveJob(job);

            if (player.CurrentLevel >= job.TargetLevel)
            {
                job.Status = "succeeded";
                job.CompletedUtc = DateTime.UtcNow;
                job.LastMessage = "이미 목표 수치 이상입니다.";
                _store.SaveJob(job);
                return;
            }

            var startedLevel = player.CurrentLevel;
            var attemptNumber = 0;

            while (!_stopping && player.CurrentLevel < job.TargetLevel)
            {
                attemptNumber++;
                var fromLevel = player.CurrentLevel;

                Thread.Sleep(700);

                player.CurrentLevel++;
                player.LastUpdatedUtc = DateTime.UtcNow;

                job.Attempts.Add(new EnhanceAttempt
                {
                    AttemptNumber = attemptNumber,
                    FromLevel = fromLevel,
                    ToLevel = player.CurrentLevel,
                    Succeeded = true,
                    Message = string.Format("+{0} 달성", player.CurrentLevel),
                    OccurredUtc = DateTime.UtcNow
                });

                job.LastMessage = string.Format("{0} -> {1}", fromLevel, player.CurrentLevel);
                _store.SaveJob(job);
            }

            if (_stopping)
            {
                job.Status = "cancelled";
                job.CompletedUtc = DateTime.UtcNow;
                job.LastMessage = "작업자가 중지되었습니다.";
                _store.SaveJob(job);
                return;
            }

            job.Status = "succeeded";
            job.CompletedUtc = DateTime.UtcNow;
            job.LastMessage = string.Format("강화 완료: {0} -> {1}", startedLevel, player.CurrentLevel);
            _store.SaveJob(job);

            _store.AddDeliveryLog(new DeliveryLog
            {
                Id = Guid.NewGuid().ToString("N"),
                Channel = "stub-channel",
                Recipient = job.UserId,
                Payload = job.LastMessage,
                Result = "queued",
                CreatedUtc = DateTime.UtcNow
            });
        }
    }
}
