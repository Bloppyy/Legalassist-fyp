import 'package:flutter/material.dart';
import '../../services/templates_service.dart';
import 'template_detail_screen.dart';

class TemplatesScreen extends StatefulWidget {
  const TemplatesScreen({super.key});

  @override
  State<TemplatesScreen> createState() => _TemplatesScreenState();
}

class _TemplatesScreenState extends State<TemplatesScreen> {
  List<dynamic> _templates = [];
  List<dynamic> _categories = [];
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();
  String _categoryFilter = '';

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
      final results = await Future.wait([
        TemplatesService.getTemplates(
          search: _searchCtrl.text.trim().isEmpty ? null : _searchCtrl.text.trim(),
          categoryId: _categoryFilter.isEmpty ? null : _categoryFilter,
        ),
        TemplatesService.getCategories(),
      ]);
      setState(() {
        _templates = results[0];
        _categories = results[1];
      });
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
                  hintText: 'Search templates…',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(icon: const Icon(Icons.clear), onPressed: () { _searchCtrl.clear(); _load(); })
                      : null,
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
                onSubmitted: (_) => _load(),
              ),
              if (_categories.isNotEmpty) ...[
                const SizedBox(height: 8),
                SizedBox(
                  height: 34,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: const Text('All'),
                          selected: _categoryFilter.isEmpty,
                          onSelected: (_) { setState(() => _categoryFilter = ''); _load(); },
                        ),
                      ),
                      ..._categories.map((c) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(c['name']),
                          selected: _categoryFilter == c['id'],
                          onSelected: (_) { setState(() => _categoryFilter = c['id']); _load(); },
                        ),
                      )),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                  : _templates.isEmpty
                      ? const Center(child: Text('No templates found.'))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            itemCount: _templates.length,
                            itemBuilder: (context, i) {
                              final t = _templates[i];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 10),
                                child: ListTile(
                                  leading: const CircleAvatar(
                                    backgroundColor: Color(0xFFE8EEF7),
                                    child: Icon(Icons.description, color: Color(0xFF1E3A5F)),
                                  ),
                                  title: Text(t['title'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                                  subtitle: t['category'] != null
                                      ? Text(t['category']['name'], style: const TextStyle(fontSize: 12))
                                      : null,
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => TemplateDetailScreen(template: t)),
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
