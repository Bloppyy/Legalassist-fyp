import 'api_service.dart';

class CasesService {
  static Future<List<dynamic>> getCases({String? search, String? status}) async {
    final params = <String, String>{};
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (status != null && status.isNotEmpty) params['status'] = status;
    final data = await ApiService.get('/cases', params: params);
    return List<dynamic>.from(data ?? []);
  }

  static Future<Map<String, dynamic>> getCase(String id) async {
    final data = await ApiService.get('/cases/$id');
    return Map<String, dynamic>.from(data);
  }
}
