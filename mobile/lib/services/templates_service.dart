import 'api_service.dart';

class TemplatesService {
  static Future<List<dynamic>> getTemplates({String? search, String? categoryId}) async {
    final params = <String, String>{};
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (categoryId != null && categoryId.isNotEmpty) params['category_id'] = categoryId;
    final data = await ApiService.get('/templates', params: params);
    return List<dynamic>.from(data ?? []);
  }

  static Future<List<dynamic>> getCategories() async {
    final data = await ApiService.get('/template-categories');
    return List<dynamic>.from(data ?? []);
  }
}
