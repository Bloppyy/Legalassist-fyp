import 'api_service.dart';

class GuidelinesService {
  static Future<List<dynamic>> getGuidelines({String? state}) async {
    final params = <String, String>{};
    if (state != null && state.isNotEmpty) params['state'] = state;
    final data = await ApiService.get('/court-guidelines', params: params);
    return List<dynamic>.from(data ?? []);
  }

  static Future<String> getDownloadUrl(String id) async {
    final data = await ApiService.get('/court-guidelines/$id/download');
    return data['url'] as String;
  }
}
