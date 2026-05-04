import 'api_service.dart';

class ContactsService {
  static Future<List<dynamic>> getContacts({String? search, String? state}) async {
    final params = <String, String>{};
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (state != null && state.isNotEmpty) params['state'] = state;
    final data = await ApiService.get('/contacts', params: params);
    return List<dynamic>.from(data ?? []);
  }
}
