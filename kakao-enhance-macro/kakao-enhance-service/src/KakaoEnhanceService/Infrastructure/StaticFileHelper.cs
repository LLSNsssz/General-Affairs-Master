using System;
using System.IO;
using System.Net;
using System.Text;

namespace KakaoEnhanceService.Infrastructure
{
    internal static class StaticFileHelper
    {
        public static bool TryWriteFile(HttpListenerResponse response, string filePath)
        {
            if (!File.Exists(filePath))
            {
                return false;
            }

            var bytes = File.ReadAllBytes(filePath);
            response.StatusCode = 200;
            response.ContentType = GetContentType(filePath);
            response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
            response.OutputStream.Close();
            return true;
        }

        public static void WriteText(HttpListenerResponse response, string text, string contentType)
        {
            var bytes = Encoding.UTF8.GetBytes(text ?? string.Empty);
            response.StatusCode = 200;
            response.ContentType = contentType;
            response.ContentEncoding = Encoding.UTF8;
            response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
            response.OutputStream.Close();
        }

        private static string GetContentType(string filePath)
        {
            var extension = Path.GetExtension(filePath).ToLowerInvariant();

            switch (extension)
            {
                case ".html":
                    return "text/html; charset=utf-8";
                case ".css":
                    return "text/css; charset=utf-8";
                case ".js":
                    return "application/javascript; charset=utf-8";
                case ".json":
                    return "application/json; charset=utf-8";
                case ".svg":
                    return "image/svg+xml";
                case ".png":
                    return "image/png";
                case ".jpg":
                case ".jpeg":
                    return "image/jpeg";
                default:
                    return "application/octet-stream";
            }
        }
    }
}
