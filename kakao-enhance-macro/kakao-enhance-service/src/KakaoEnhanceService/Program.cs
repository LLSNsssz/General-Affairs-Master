using System;
using KakaoEnhanceService.Infrastructure;
using KakaoEnhanceService.Services;

namespace KakaoEnhanceService
{
    internal static class Program
    {
        private static void Main(string[] args)
        {
            var prefix = args.Length > 0 && !string.IsNullOrWhiteSpace(args[0])
                ? args[0]
                : "http://localhost:5088/";

            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var dataPath = System.IO.Path.Combine(baseDir, "data", "store.json");
            var store = new InMemoryStore(dataPath);
            SeedData.Seed(store);

            using (var worker = new EnhanceWorker(store))
            using (var server = new ApiServer(prefix, store, new CommandParser()))
            {
                Console.WriteLine("Store path: " + dataPath);
                worker.Start();
                server.Run();
            }
        }
    }
}
