import 'api_service.dart';

class DeadlinesService {
  static Future<List<dynamic>> getDeadlines({bool upcomingOnly = false, String? caseId}) async {
    final params = <String, String>{};
    if (upcomingOnly) params['upcoming'] = 'true';
    if (caseId != null && caseId.isNotEmpty) params['case_id'] = caseId;
    final data = await ApiService.get('/deadlines', params: params);
    return List<dynamic>.from(data ?? []);
  }

  static Future<void> toggleComplete(String id) async {
    await ApiService.patch('/deadlines/$id/toggle-complete');
  }
}
