import 'api_service.dart';

class ChecklistService {
  static Future<Map<String, dynamic>?> getCaseChecklist(String caseId) async {
    final data = await ApiService.get('/cases/$caseId/checklist');
    return data as Map<String, dynamic>?;
  }

  static Future<void> updateItem(
      String caseId, String itemId, Map<String, dynamic> body) async {
    await ApiService.patchJson('/cases/$caseId/checklist/items/$itemId', body);
  }
}
