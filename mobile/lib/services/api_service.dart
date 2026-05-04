import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

/// Central HTTP client for all backend API calls.
/// Automatically attaches the Supabase JWT to every request.
class ApiService {
  static const String _baseUrl = 'http://10.0.2.2:5000/api';

  static Future<Map<String, String>> _headers() async {
    final session = Supabase.instance.client.auth.currentSession;
    final token = session?.accessToken ?? '';
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  static Future<dynamic> get(String path, {Map<String, String>? params}) async {
    var uri = Uri.parse('$_baseUrl$path');
    if (params != null && params.isNotEmpty) {
      uri = uri.replace(queryParameters: params);
    }
    final res = await http.get(uri, headers: await _headers());
    return _parse(res);
  }

  static Future<dynamic> patch(String path) async {
    final uri = Uri.parse('$_baseUrl$path');
    final res = await http.patch(uri, headers: await _headers());
    return _parse(res);
  }

  static dynamic _parse(http.Response res) {
    final body = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body['data'];
    }
    throw ApiException(body['message'] ?? 'Request failed', res.statusCode);
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  const ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}
