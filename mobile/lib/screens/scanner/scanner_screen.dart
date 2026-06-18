import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/ocr_service.dart';
import '../../services/api_service.dart';
import '../../services/cases_service.dart';

enum _ScanState { initial, scanning, result, editing }

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  _ScanState _state = _ScanState.initial;
  String _text = '';
  final _editController = TextEditingController();
  bool _isParsing = false;

  @override
  void dispose() {
    _editController.dispose();
    super.dispose();
  }

  Future<void> _scan() async {
    setState(() => _state = _ScanState.scanning);
    try {
      final text = await OcrService.scanFromCamera();
      if (text == null || text.isEmpty) {
        // User cancelled or nothing extracted
        setState(() => _state = _ScanState.initial);
        return;
      }
      setState(() {
        _text = text;
        _state = _ScanState.result;
      });
    } catch (e) {
      setState(() => _state = _ScanState.initial);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Scan failed: $e')),
        );
      }
    }
  }

  void _reset() {
    setState(() {
      _state = _ScanState.initial;
      _text = '';
      _editController.clear();
    });
  }

  void _useAsDocumentText() {
    _editController.text = _text;
    setState(() => _state = _ScanState.editing);
  }

  Future<void> _parseAsArahan() async {
    final selectedCase = await _showCasePicker();
    if (selectedCase == null || !mounted) return;

    setState(() => _isParsing = true);
    try {
      final caseId = selectedCase['id'] as String;
      final caseName = '${selectedCase['case_number']} — ${selectedCase['client_name']}';

      final parsed = await ApiService.postForm(
        '/case-stages/$caseId/parse-direction',
        {'text': _text},
      );

      if (!mounted) return;
      await _showStageConfirmSheet(caseId, caseName, parsed as Map<String, dynamic>);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to parse arahan')),
        );
      }
    } finally {
      if (mounted) setState(() => _isParsing = false);
    }
  }

  Future<Map<String, dynamic>?> _showCasePicker() {
    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => const _CasePickerDialog(),
    );
  }

  Future<void> _showStageConfirmSheet(
    String caseId,
    String caseName,
    Map<String, dynamic> parsed,
  ) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _StageConfirmSheet(
        caseId: caseId,
        caseName: caseName,
        parsed: parsed,
      ),
    );
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Stage saved successfully')),
      );
      Navigator.of(context).pop();
    }
  }

  // ---------------------------------------------------------------------------
  // UI builders
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Document'),
        actions: [
          if (_state != _ScanState.initial)
            TextButton(
              onPressed: _reset,
              child: const Text('Scan Again'),
            ),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 200),
        child: switch (_state) {
          _ScanState.initial => _buildInitial(),
          _ScanState.scanning => _buildScanning(),
          _ScanState.result => _buildResult(),
          _ScanState.editing => _buildEditing(),
        },
      ),
    );
  }

  Widget _buildInitial() {
    return Center(
      key: const ValueKey('initial'),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.document_scanner_outlined,
              size: 96, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 24),
          const Text('Photograph an arahan or any document',
              style: TextStyle(fontSize: 16)),
          const SizedBox(height: 8),
          Text('Text will be extracted automatically',
              style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          const SizedBox(height: 32),
          FilledButton.icon(
            onPressed: _scan,
            icon: const Icon(Icons.camera_alt),
            label: const Text('Open Camera'),
          ),
        ],
      ),
    );
  }

  Widget _buildScanning() {
    return const Center(
      key: ValueKey('scanning'),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 20),
          Text('Extracting text…'),
        ],
      ),
    );
  }

  Widget _buildResult() {
    return Padding(
      key: const ValueKey('result'),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Extracted Text',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Expanded(
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: SingleChildScrollView(
                  child: SelectableText(
                    _text,
                    style: const TextStyle(fontSize: 13, height: 1.5),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (_isParsing)
            const Center(child: CircularProgressIndicator())
          else ...[
            if (['associate', 'partner', 'admin']
                .contains(context.read<AuthProvider>().role)) ...[
              FilledButton.icon(
                onPressed: _parseAsArahan,
                icon: const Icon(Icons.auto_awesome),
                label: const Text('Parse as Arahan'),
              ),
              const SizedBox(height: 8),
            ],
            OutlinedButton.icon(
              onPressed: _useAsDocumentText,
              icon: const Icon(Icons.edit_note),
              label: const Text('Use as Document Text'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEditing() {
    return Padding(
      key: const ValueKey('editing'),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text('Extracted Text',
                  style: Theme.of(context).textTheme.titleMedium),
              const Spacer(),
              TextButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _editController.text));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Copied to clipboard')),
                  );
                },
                icon: const Icon(Icons.copy, size: 18),
                label: const Text('Copy'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: TextField(
              controller: _editController,
              maxLines: null,
              expands: true,
              textAlignVertical: TextAlignVertical.top,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.all(12),
              ),
              style: const TextStyle(fontSize: 13, height: 1.5),
            ),
          ),
        ],
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
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
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
              controller: _searchController,
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

// ---------------------------------------------------------------------------
// Stage confirmation bottom sheet
// ---------------------------------------------------------------------------

const _stageTypes = [
  'court_appearance',
  'court_direction',
  'meeting',
  'filing_deadline',
  'year_end_review',
  'other',
];

class _StageConfirmSheet extends StatefulWidget {
  final String caseId;
  final String caseName;
  final Map<String, dynamic> parsed;

  const _StageConfirmSheet({
    required this.caseId,
    required this.caseName,
    required this.parsed,
  });

  @override
  State<_StageConfirmSheet> createState() => _StageConfirmSheetState();
}

class _StageConfirmSheetState extends State<_StageConfirmSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleCtrl;
  late final TextEditingController _courtCtrl;
  late final TextEditingController _directionsCtrl;
  late String _stageType;
  DateTime? _stageDate;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final p = widget.parsed;
    final actions = (p['required_actions'] as List?)?.cast<String>() ?? [];

    _titleCtrl = TextEditingController(
      text: actions.isNotEmpty ? actions.first : 'Court Stage',
    );
    _courtCtrl = TextEditingController(text: p['court_name'] as String? ?? '');
    _directionsCtrl = TextEditingController(text: actions.join('\n'));
    _stageType = 'court_direction';

    final dateStr = p['next_court_date'] as String?;
    if (dateStr != null) {
      _stageDate = DateTime.tryParse(dateStr);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _courtCtrl.dispose();
    _directionsCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _stageDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) setState(() => _stageDate = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_stageDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a stage date')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final confidence = widget.parsed['confidence'];
      await ApiService.post('/case-stages', {
        'case_id': widget.caseId,
        'stage_type': _stageType,
        'title': _titleCtrl.text.trim(),
        'stage_date': _stageDate!.toIso8601String().split('T')[0],
        'next_court_date': _stageDate!.toIso8601String().split('T')[0],
        'court_name': _courtCtrl.text.trim().isEmpty ? null : _courtCtrl.text.trim(),
        'directions': _directionsCtrl.text.trim().isEmpty ? null : _directionsCtrl.text.trim(),
        'direction_source': 'physical',
        'ai_parsed': true,
        'confidence': confidence,
      });
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save stage')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final confidence = widget.parsed['confidence'] as double?;

    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Text('Confirm Stage',
                      style: Theme.of(context).textTheme.titleLarge),
                  const Spacer(),
                  if (confidence != null)
                    Chip(
                      avatar: const Icon(Icons.auto_awesome, size: 16),
                      label: Text(
                        'AI ${(confidence * 100).toStringAsFixed(0)}%',
                        style: const TextStyle(fontSize: 12),
                      ),
                      backgroundColor: confidence >= 0.7
                          ? Colors.green[50]
                          : confidence >= 0.4
                              ? Colors.amber[50]
                              : Colors.red[50],
                    ),
                ],
              ),
              Text(widget.caseName,
                  style: TextStyle(color: Colors.grey[600], fontSize: 13)),
              const SizedBox(height: 16),
              TextFormField(
                controller: _titleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Title *',
                  border: OutlineInputBorder(),
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Title is required' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _stageType,
                decoration: const InputDecoration(
                  labelText: 'Stage Type *',
                  border: OutlineInputBorder(),
                ),
                items: _stageTypes
                    .map((t) => DropdownMenuItem(
                          value: t,
                          child: Text(
                            t.replaceAll('_', ' '),
                            style: const TextStyle(
                              textBaseline: TextBaseline.alphabetic,
                            ),
                          ),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _stageType = v!),
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: _pickDate,
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Stage Date *',
                    border: OutlineInputBorder(),
                    suffixIcon: Icon(Icons.calendar_today, size: 18),
                  ),
                  child: Text(
                    _stageDate != null
                        ? '${_stageDate!.year}-'
                            '${_stageDate!.month.toString().padLeft(2, '0')}-'
                            '${_stageDate!.day.toString().padLeft(2, '0')}'
                        : 'Tap to select',
                    style: TextStyle(
                      color: _stageDate != null ? null : Colors.grey[500],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _courtCtrl,
                decoration: const InputDecoration(
                  labelText: 'Court Name',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _directionsCtrl,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Directions / Required Actions',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Stage'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
