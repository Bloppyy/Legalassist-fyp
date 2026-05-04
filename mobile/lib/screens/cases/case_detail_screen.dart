import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/cases_service.dart';
import '../../services/deadlines_service.dart';

class CaseDetailScreen extends StatefulWidget {
  final String caseId;
  const CaseDetailScreen({super.key, required this.caseId});

  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  Map<String, dynamic>? _case;
  List<dynamic> _deadlines = [];
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
        DeadlinesService.getDeadlines(caseId: widget.caseId),
      ]);
      setState(() {
        _case = results[0] as Map<String, dynamic>;
        _deadlines = results[1] as List<dynamic>;
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
                      const SizedBox(height: 16),
                      _DeadlinesSection(deadlines: _deadlines),
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
            if (caseData['storage_location'] != null) _Row('Storage', caseData['storage_location']),
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

class _DeadlinesSection extends StatelessWidget {
  final List<dynamic> deadlines;
  const _DeadlinesSection({required this.deadlines});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Deadlines', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (deadlines.isEmpty)
          const Text('No deadlines for this case.', style: TextStyle(color: Colors.grey))
        else
          ...deadlines.map((d) {
            final date = DateFormat('d MMM yyyy').format(DateTime.parse(d['deadline_date']));
            final overdue = !d['is_completed'] && DateTime.parse(d['deadline_date']).isBefore(DateTime.now());
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                dense: true,
                leading: Icon(
                  d['is_completed'] == true ? Icons.check_circle : overdue ? Icons.warning_amber : Icons.circle_outlined,
                  color: d['is_completed'] == true ? Colors.green : overdue ? Colors.red : Colors.blue,
                ),
                title: Text(d['title'] ?? '—'),
                subtitle: Text('${d['court_name']} · $date'),
              ),
            );
          }),
      ],
    );
  }
}
