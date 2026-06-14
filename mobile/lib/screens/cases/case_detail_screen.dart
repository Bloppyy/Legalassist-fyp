import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/cases_service.dart';
import '../../services/case_stages_service.dart';
import '../../services/checklist_service.dart';

const _stageColors = {
  'court_appearance': Color(0xFF1c64f2),
  'court_direction': Color(0xFFc27803),
  'meeting': Color(0xFF057a55),
  'filing_deadline': Color(0xFFe02424),
  'year_end_review': Color(0xFF7e3af2),
  'other': Color(0xFF6b7280),
};

const _stageIcons = {
  'court_appearance': Icons.gavel,
  'court_direction': Icons.description,
  'meeting': Icons.calendar_today,
  'filing_deadline': Icons.access_time,
  'year_end_review': Icons.star,
  'other': Icons.info_outline,
};

class CaseDetailScreen extends StatefulWidget {
  final String caseId;
  const CaseDetailScreen({super.key, required this.caseId});

  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  Map<String, dynamic>? _case;
  List<dynamic> _stages = [];
  List<dynamic> _checklistItems = [];
  int _checklistDone = 0;
  int _checklistTotal = 0;
  double _checklistProgress = 0;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        CasesService.getCase(widget.caseId),
        CaseStagesService.getStages(widget.caseId),
        ChecklistService.getCaseChecklist(widget.caseId),
      ]);
      final cl = results[2] as Map<String, dynamic>?;
      setState(() {
        _case = results[0] as Map<String, dynamic>;
        _stages = (results[1] as List<dynamic>).reversed.toList();
        _checklistItems = (cl?['items'] as List<dynamic>?) ?? [];
        _checklistDone = cl?['done'] as int? ?? 0;
        _checklistTotal = cl?['total'] as int? ?? 0;
        _checklistProgress = (cl?['progress_pct'] as num?)?.toDouble() ?? 0.0;
      });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_case?['case_number'] ?? 'Case Detail')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _InfoCard(caseData: _case!),
                      const SizedBox(height: 20),
                      _TimelineSection(stages: _stages),
                      const SizedBox(height: 20),
                      _ChecklistSection(
                        caseId: widget.caseId,
                        items: _checklistItems,
                        done: _checklistDone,
                        total: _checklistTotal,
                        progress: _checklistProgress,
                        onChanged: _load,
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final Map<String, dynamic> caseData;
  const _InfoCard({required this.caseData});

  @override
  Widget build(BuildContext context) {
    final isActive = caseData['status'] == 'active';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Case Details', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                const Spacer(),
                Chip(
                  label: Text(caseData['status'] ?? '—', style: const TextStyle(fontSize: 12)),
                  backgroundColor: isActive ? Colors.green[50] : Colors.grey[100],
                ),
              ],
            ),
            const Divider(),
            _Row('Case Number', caseData['case_number']),
            _Row('Client', caseData['client_name']),
            _Row('Year', caseData['year']?.toString()),
            if (caseData['description'] != null) _Row('Description', caseData['description']),
            if (caseData['assigned_user'] != null) _Row('Assigned To', caseData['assigned_user']['name']),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String? value;
  const _Row(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 13))),
          Expanded(child: Text(value ?? '—', style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }
}

class _TimelineSection extends StatefulWidget {
  final List<dynamic> stages;
  const _TimelineSection({required this.stages});

  @override
  State<_TimelineSection> createState() => _TimelineSectionState();
}

class _TimelineSectionState extends State<_TimelineSection> {
  String? _expandedId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Case Timeline', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        if (widget.stages.isEmpty)
          const Text('No stages recorded yet.', style: TextStyle(color: Colors.grey))
        else
          ...List.generate(widget.stages.length, (i) {
            final s = widget.stages[i];
            final isLast = i == widget.stages.length - 1;
            return _StageNode(
              stage: s,
              isLast: isLast,
              isExpanded: _expandedId == s['id'],
              onTap: () => setState(() {
                _expandedId = _expandedId == s['id'] ? null : s['id'];
              }),
            );
          }),
      ],
    );
  }
}

class _StageNode extends StatelessWidget {
  final Map<String, dynamic> stage;
  final bool isLast;
  final bool isExpanded;
  final VoidCallback onTap;

  const _StageNode({
    required this.stage,
    required this.isLast,
    required this.isExpanded,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final type = stage['stage_type'] as String? ?? 'other';
    final color = _stageColors[type] ?? const Color(0xFF6b7280);
    final icon = _stageIcons[type] ?? Icons.info_outline;
    final completed = stage['is_completed'] == true;
    final nodeColor = completed ? Colors.grey[400]! : color;

    final date = stage['stage_date'] != null
        ? DateFormat('d MMM yyyy').format(DateTime.parse(stage['stage_date']))
        : '—';

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Left: vertical line + circle
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: completed ? Colors.grey[200] : color.withValues(alpha: 0.12),
                    border: Border.all(color: nodeColor, width: 2),
                  ),
                  child: Icon(icon, size: 16, color: nodeColor),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(width: 2, color: Colors.grey[300]),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Right: content
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
              child: GestureDetector(
                onTap: onTap,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: isExpanded ? color.withValues(alpha: 0.05) : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isExpanded ? color.withValues(alpha: 0.3) : Colors.transparent,
                    ),
                  ),
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              stage['title'] ?? '—',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: completed ? Colors.grey[500] : null,
                                decoration: completed ? TextDecoration.lineThrough : null,
                              ),
                            ),
                          ),
                          if (stage['ai_parsed'] == true)
                            Container(
                              margin: const EdgeInsets.only(left: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.purple[50],
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text('AI', style: TextStyle(fontSize: 10, color: Colors.purple[700], fontWeight: FontWeight.bold)),
                            ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${type.replaceAll('_', ' ')} · $date',
                        style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                      ),
                      if (stage['court_name'] != null)
                        Text(stage['court_name'], style: TextStyle(fontSize: 12, color: Colors.grey[600])),

                      // Expanded details
                      if (isExpanded) ...[
                        const SizedBox(height: 10),
                        const Divider(height: 1),
                        const SizedBox(height: 10),
                        if (stage['directions'] != null && (stage['directions'] as String).isNotEmpty)
                          _DetailRow('Directions', stage['directions']),
                        if (stage['next_court_date'] != null)
                          _DetailRow('Next Court Date', DateFormat('d MMM yyyy').format(DateTime.parse(stage['next_court_date']))),
                        if (stage['direction_source'] != null)
                          _DetailRow('Source', stage['direction_source'].toString().replaceAll('_', ' ')),
                        if (stage['recorder'] != null)
                          _DetailRow('Recorded by', stage['recorder']['name']),
                        if (completed)
                          Container(
                            margin: const EdgeInsets.only(top: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.green[50],
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('Completed', style: TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w600)),
                          ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String? value;
  const _DetailRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ),
          Expanded(child: Text(value!, style: const TextStyle(fontSize: 12))),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Checklist section
// ---------------------------------------------------------------------------

class _ChecklistSection extends StatefulWidget {
  final String caseId;
  final List<dynamic> items;
  final int done;
  final int total;
  final double progress;
  final VoidCallback onChanged;

  const _ChecklistSection({
    required this.caseId,
    required this.items,
    required this.done,
    required this.total,
    required this.progress,
    required this.onChanged,
  });

  @override
  State<_ChecklistSection> createState() => _ChecklistSectionState();
}

class _ChecklistSectionState extends State<_ChecklistSection> {
  String? _togglingId;

  Future<void> _toggle(Map<String, dynamic> item) async {
    final id = item['id'] as String;
    final isDone = item['status'] == 'done';
    setState(() => _togglingId = id);
    try {
      await ChecklistService.updateItem(
        widget.caseId,
        id,
        {'status': isDone ? 'pending' : 'done'},
      );
      widget.onChanged();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update checklist item')),
        );
      }
    } finally {
      if (mounted) setState(() => _togglingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Case Checklist',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            if (widget.total > 0) ...[
              const SizedBox(width: 10),
              Text(
                '${widget.done}/${widget.total} done',
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
              ),
            ],
          ],
        ),
        if (widget.total > 0) ...[
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: widget.progress / 100,
              minHeight: 6,
              backgroundColor: Colors.grey[200],
              color: Colors.green,
            ),
          ),
        ],
        const SizedBox(height: 10),
        if (widget.items.isEmpty)
          Text('No checklist items.', style: TextStyle(color: Colors.grey[500], fontSize: 13))
        else
          ...widget.items.map((item) => _ChecklistItemTile(
                item: item as Map<String, dynamic>,
                toggling: _togglingId == item['id'],
                onTap: () => _toggle(item),
              )),
      ],
    );
  }
}

class _ChecklistItemTile extends StatelessWidget {
  final Map<String, dynamic> item;
  final bool toggling;
  final VoidCallback onTap;

  const _ChecklistItemTile({
    required this.item,
    required this.toggling,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final status = item['status'] as String? ?? 'pending';
    final isDone = status == 'done';
    final isSkipped = status == 'skipped';
    final completer = item['completer'] as Map<String, dynamic>?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: isSkipped ? null : onTap,
            child: toggling
                ? const SizedBox(
                    width: 22, height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      color: isDone ? Colors.green : Colors.transparent,
                      border: Border.all(
                        color: isDone ? Colors.green : isSkipped ? Colors.grey[300]! : Colors.grey[400]!,
                        width: 2,
                      ),
                    ),
                    child: isDone
                        ? const Icon(Icons.check, size: 14, color: Colors.white)
                        : null,
                  ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item['title'] as String? ?? '—',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: (isDone || isSkipped) ? Colors.grey[500] : null,
                    decoration: (isDone || isSkipped) ? TextDecoration.lineThrough : null,
                  ),
                ),
                if (isDone && completer != null)
                  Text(
                    '✓ ${completer['name']} · ${DateFormat('d MMM yyyy').format(DateTime.parse(item['completed_at'] as String))}',
                    style: const TextStyle(fontSize: 11, color: Colors.green),
                  ),
                if (isSkipped)
                  Text('skipped', style: TextStyle(fontSize: 11, color: Colors.grey[400])),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
