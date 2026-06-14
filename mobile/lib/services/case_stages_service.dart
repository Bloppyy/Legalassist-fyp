import 'api_service.dart';

class CaseStagesService {
  static Future<List<dynamic>> getStages(String caseId) async {
    final data = await ApiService.get('/case-stages', params: {'case_id': caseId});
    return List<dynamic>.from(data ?? []);
  }
}
