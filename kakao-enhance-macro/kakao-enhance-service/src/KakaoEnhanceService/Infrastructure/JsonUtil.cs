using System.IO;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;

namespace KakaoEnhanceService.Infrastructure
{
    internal static class JsonUtil
    {
        public static string ReadBody(HttpListenerRequest request)
        {
            using (var reader = new StreamReader(request.InputStream, request.ContentEncoding ?? Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        public static T Deserialize<T>(string json) where T : class
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            return new JavaScriptSerializer().Deserialize<T>(json);
        }

        public static string Serialize(object value)
        {
            return new JavaScriptSerializer().Serialize(value);
        }

        public static void WriteJson(HttpListenerResponse response, int statusCode, object payload)
        {
            var bytes = Encoding.UTF8.GetBytes(Serialize(payload));
            response.StatusCode = statusCode;
            response.ContentType = "application/json; charset=utf-8";
            response.ContentEncoding = Encoding.UTF8;
            response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
            response.OutputStream.Close();
        }
    }
}
