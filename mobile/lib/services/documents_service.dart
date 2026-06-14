import 'dart:typed_data';
import 'api_service.dart';

class DocumentsService {
  static const _docxMime =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  static Future<List<dynamic>> getDocuments({String? status}) async {
    final params = <String, String>{'own': 'true'};
    if (status != null && status.isNotEmpty) params['status'] = status;
    final data = await ApiService.get('/documents', params: params);
    return List<dynamic>.from(data ?? []);
  }

  static Future<dynamic> getDownloadUrl(String id) async {
    return ApiService.get('/documents/$id/download');
  }

  static Future<dynamic> create({
    required String title,
    String? caseId,
    Uint8List? fileBytes,
    String? fileName,
  }) async {
    final fields = <String, String>{'title': title};
    if (caseId != null) fields['case_id'] = caseId;
    return ApiService.postMultipartFile(
      '/documents',
      fields: fields,
      fileBytes: fileBytes,
      fileName: fileName,
      fileField: fileBytes != null ? 'file' : null,
      mimeType: _docxMime,
    );
  }

  static Future<void> submit(String id) async {
    await ApiService.patch('/documents/$id/submit');
  }
}
