import 'package:flutter/material.dart';
import '../../services/cases_service.dart';
import 'case_detail_screen.dart';

class CasesScreen extends StatefulWidget {
  const CasesScreen({super.key});

  @override
  State<CasesScreen> createState() => _CasesScreenState();
}

class _CasesScreenState extends State<CasesScreen> {
  List<dynamic> _cases = [];
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();
  String _statusFilter = '';

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
    setState(() { _loading = true; _error = null; });
    try {
      final data = await CasesService.getCases(
        search: _searchCtrl.text.trim().isEmpty ? null : _searchCtrl.text.trim(),
        status: _statusFilter.isEmpty ? null : _statusFilter,
      );
      setState(() { _cases = data; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Column(
            children: [
              TextField(
                controller: _searchCtrl,
                decoration: InputDecoration(
                  hintText: 'Search cases…',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(icon: const Icon(Icons.clear), onPressed: () { _searchCtrl.clear(); _load(); })
                      : null,
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
                onSubmitted: (_) => _load(),
              ),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: '', label: Text('All')),
                  ButtonSegment(value: 'active', label: Text('Active')),
                  ButtonSegment(value: 'closed', label: Text('Closed')),
                ],
                selected: {_statusFilter},
                onSelectionChanged: (s) { setState(() => _statusFilter = s.first); _load(); },
              ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                  : _cases.isEmpty
                      ? const Center(child: Text('No cases found.'))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            itemCount: _cases.length,
                            itemBuilder: (context, i) {
                              final c = _cases[i];
                              final isActive = c['status'] == 'active';
                              return Card(
                                margin: const EdgeInsets.only(bottom: 10),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: isActive ? Colors.green[100] : Colors.grey[200],
                                    child: Icon(
                                      Icons.folder,
                                      color: isActive ? Colors.green[700] : Colors.grey[600],
                                    ),
                                  ),
                                  title: Text(c['case_number'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                                  subtitle: Text(c['client_name'] ?? '—'),
                                  trailing: Chip(
                                    label: Text(
                                      c['status'] ?? '—',
                                      style: const TextStyle(fontSize: 11),
                                    ),
                                    backgroundColor: isActive ? Colors.green[50] : Colors.grey[100],
                                  ),
                                  onTap: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: c['id'])),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
        ),
      ],
    );
  }
}
