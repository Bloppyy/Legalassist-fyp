import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/api_service.dart';
import '../../services/cases_service.dart';
import '../../services/documents_service.dart';

// Status colours matching the web app
const _statusColors = <String, Color>{
  'draft': Color(0xFF6B7280),
  'pending_associate': Color(0xFFC27803),
  'pending_partner': Color(0xFF7E3AF2),
  'approved': Color(0xFF057A55),
  'filed': Color(0xFF1C64F2),
  'served': Color(0xFF0694A2),
  'rejected': Color(0xFFE02424),
};

Color _colorFor(String? status) =>
    _statusColors[status] ?? const Color(0xFF6B7280);

// ---------------------------------------------------------------------------
// Documents tab screen
// ---------------------------------------------------------------------------

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  List<dynamic> _docs = [];
  bool _loading = true;
  String? _error;
  String _statusFilter = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await DocumentsService.getDocuments(
        status: _statusFilter.isEmpty ? null : _statusFilter,
      );
      if (mounted) setState(() => _docs = data);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showDetail(Map<String, dynamic> doc) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _DocumentDetailSheet(doc: doc, onRefresh: _load),
    );
  }

  Future<void> _showCreateSheet() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const _CreateDocumentSheet(),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
          children: [
            _buildFilterBar(),
            Expanded(child: _buildBody()),
          ],
        ),
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton(
            heroTag: 'create_doc_fab',
            onPressed: _showCreateSheet,
            tooltip: 'Create Document',
            child: const Icon(Icons.add),
          ),
        ),
      ],
    );
  }

  Widget _buildFilterBar() {
    const filters = <String>['', 'draft', 'pending_associate', 'pending_partner', 'approved', 'filed', 'served', 'rejected'];
    const labels = <String>['All', 'Draft', 'Pending', 'Escalated', 'Approved', 'Filed', 'Served', 'Rejected'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Row(
        children: List.generate(filters.length, (i) {
          final selected = _statusFilter == filters[i];
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: FilterChip(
              label: Text(labels[i]),
              selected: selected,
              onSelected: (_) {
                setState(() => _statusFilter = filters[i]);
                _load();
              },
            ),
          );
        }),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, style: const TextStyle(color: Colors.red)),
            TextButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_docs.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.description_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 12),
            Text(
              _statusFilter.isEmpty ? 'No documents yet' : 'No documents with this status',
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
        itemCount: _docs.length,
        itemBuilder: (_, i) => _buildDocTile(_docs[i] as Map<String, dynamic>),
      ),
    );
  }

  Widget _buildDocTile(Map<String, dynamic> doc) {
    final status = doc['status'] as String? ?? 'draft';
    final color = _colorFor(status);
    final caseFile = doc['case_file'] as Map<String, dynamic>?;
    final createdAt = doc['created_at'] as String?;
    final dateStr = createdAt != null
        ? DateFormat('d MMM yyyy').format(DateTime.parse(createdAt).toLocal())
        : '';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.12),
          child: Icon(Icons.description, color: color, size: 20),
        ),
        title: Text(
          doc['title'] as String? ?? '—',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (caseFile != null)
              Text(
                '${caseFile['case_number']} — ${caseFile['client_name']}',
                style: const TextStyle(fontSize: 12),
              ),
            Text(dateStr, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
        trailing: _StatusBadge(status: status),
        isThreeLine: caseFile != null,
        onTap: () => _showDetail(doc),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = _colorFor(status);
    final label = status.replaceAll('_', ' ');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Document detail bottom sheet
// ---------------------------------------------------------------------------

class _DocumentDetailSheet extends StatefulWidget {
  final Map<String, dynamic> doc;
  final VoidCallback onRefresh;

  const _DocumentDetailSheet({required this.doc, required this.onRefresh});

  @override
  State<_DocumentDetailSheet> createState() => _DocumentDetailSheetState();
}

class _DocumentDetailSheetState extends State<_DocumentDetailSheet> {
  bool _submitting = false;
  bool _downloading = false;

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await DocumentsService.submit(widget.doc['id'] as String);
      if (mounted) {
        widget.onRefresh();
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Document submitted for review')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _download() async {
    setState(() => _downloading = true);
    try {
      final result =
          await DocumentsService.getDownloadUrl(widget.doc['id'] as String);
      final url = (result as Map<String, dynamic>?)?['url'] as String?;
      if (url != null && mounted) {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to open download link')),
        );
      }
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final doc = widget.doc;
    final status = doc['status'] as String? ?? 'draft';
    final caseFile = doc['case_file'] as Map<String, dynamic>?;
    final reviewer = doc['reviewer'] as Map<String, dynamic>?;
    final hasFile = doc['file_url'] != null;
    final isDraft = status == 'draft';
    final isRejected = status == 'rejected';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  doc['title'] as String? ?? '—',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              const SizedBox(width: 8),
              _StatusBadge(status: status),
            ],
          ),
          const SizedBox(height: 12),
          if (caseFile != null) ...[
            _DetailRow(
              label: 'Case',
              value: '${caseFile['case_number']} — ${caseFile['client_name']}',
            ),
            const SizedBox(height: 6),
          ],
          if (doc['created_at'] != null)
            _DetailRow(
              label: 'Created',
              value: DateFormat('d MMM yyyy')
                  .format(DateTime.parse(doc['created_at'] as String).toLocal()),
            ),
          if (doc['file_name'] != null) ...[
            const SizedBox(height: 6),
            _DetailRow(label: 'File', value: doc['file_name'] as String),
          ],
          if (reviewer != null) ...[
            const SizedBox(height: 6),
            _DetailRow(
                label: 'Reviewer', value: reviewer['name'] as String? ?? '—'),
          ],
          if (isRejected && doc['reviewer_comments'] != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red[50],
                border: Border.all(color: Colors.red.shade200),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Reviewer Comments',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: Colors.red,
                        fontSize: 12),
                  ),
                  const SizedBox(height: 4),
                  Text(doc['reviewer_comments'] as String,
                      style: const TextStyle(fontSize: 13)),
                ],
              ),
            ),
          ],
          if ((doc['tags'] as List<dynamic>?)?.isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final tag in doc['tags'] as List<dynamic>)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.blue[50],
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(color: Colors.blue.shade200),
                    ),
                    child: Text(
                      tag as String,
                      style: TextStyle(fontSize: 11, color: Colors.blue[700], fontWeight: FontWeight.w500),
                    ),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 20),
          if (hasFile)
            OutlinedButton.icon(
              onPressed: _downloading ? null : _download,
              icon: _downloading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.download),
              label: const Text('Download Word File'),
            ),
          if (isDraft) ...[
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.send),
              label: const Text('Submit for Review'),
            ),
          ],
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 72,
          child: Text(
            label,
            style: TextStyle(
                color: Colors.grey[600],
                fontSize: 12,
                fontWeight: FontWeight.w500),
          ),
        ),
        Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Create document bottom sheet
// ---------------------------------------------------------------------------

class _CreateDocumentSheet extends StatefulWidget {
  const _CreateDocumentSheet();

  @override
  State<_CreateDocumentSheet> createState() => _CreateDocumentSheetState();
}

class _CreateDocumentSheetState extends State<_CreateDocumentSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  Map<String, dynamic>? _selectedCase;
  String? _selectedFileName;
  Uint8List? _selectedFileBytes;
  bool _saving = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['docx'],
      withData: true,
    );
    if (result != null && result.files.isNotEmpty) {
      final f = result.files.single;
      setState(() {
        _selectedFileName = f.name;
        _selectedFileBytes = f.bytes;
      });
    }
  }

  Future<void> _pickCase() async {
    final selected = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => const _CasePickerDialog(),
    );
    if (selected != null) setState(() => _selectedCase = selected);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await DocumentsService.create(
        title: _titleCtrl.text.trim(),
        caseId: _selectedCase?['id'] as String?,
        fileBytes: _selectedFileBytes,
        fileName: _selectedFileName,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to create document')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text('New Document',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(
                labelText: 'Title *',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.sentences,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Title is required' : null,
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickCase,
              icon: const Icon(Icons.folder_open, size: 18),
              label: Text(
                _selectedCase != null
                    ? '${_selectedCase!['case_number']} — ${_selectedCase!['client_name']}'
                    : 'Link to Case (optional)',
                overflow: TextOverflow.ellipsis,
              ),
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
            if (_selectedCase != null)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => setState(() => _selectedCase = null),
                  child: const Text('Remove',
                      style: TextStyle(fontSize: 12)),
                ),
              ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _pickFile,
              icon: const Icon(Icons.upload_file, size: 18),
              label: Text(
                _selectedFileName ?? 'Choose .docx file (optional)',
                overflow: TextOverflow.ellipsis,
              ),
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
            if (_selectedFileName != null)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => setState(() {
                    _selectedFileName = null;
                    _selectedFileBytes = null;
                  }),
                  child: const Text('Remove', style: TextStyle(fontSize: 12)),
                ),
              ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _submit,
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Create Document'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Case picker dialog
// ---------------------------------------------------------------------------

class _CasePickerDialog extends StatefulWidget {
  const _CasePickerDialog();

  @override
  State<_CasePickerDialog> createState() => _CasePickerDialogState();
}

class _CasePickerDialogState extends State<_CasePickerDialog> {
  List<dynamic> _cases = [];
  List<dynamic> _filtered = [];
  bool _loading = true;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final cases = await CasesService.getCases();
      if (mounted) {
        setState(() {
          _cases = cases;
          _filtered = cases;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _filter(String q) {
    final lower = q.toLowerCase();
    setState(() {
      _filtered = _cases.where((c) {
        return (c['case_number'] as String).toLowerCase().contains(lower) ||
            (c['client_name'] as String).toLowerCase().contains(lower);
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Select Case'),
      contentPadding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      content: SizedBox(
        width: double.maxFinite,
        height: 400,
        child: Column(
          children: [
            TextField(
              controller: _searchCtrl,
              decoration: const InputDecoration(
                hintText: 'Search by case number or client',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: _filter,
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _filtered.isEmpty
                      ? const Center(child: Text('No cases found'))
                      : ListView.builder(
                          itemCount: _filtered.length,
                          itemBuilder: (ctx, i) {
                            final c = _filtered[i] as Map<String, dynamic>;
                            return ListTile(
                              dense: true,
                              title: Text(c['case_number'] as String),
                              subtitle: Text(c['client_name'] as String),
                              onTap: () => Navigator.of(ctx).pop(c),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
      ],
    );
  }
}
