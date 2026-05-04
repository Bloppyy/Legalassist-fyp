import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/guidelines_service.dart';

class GuidelinesScreen extends StatefulWidget {
  const GuidelinesScreen({super.key});

  @override
  State<GuidelinesScreen> createState() => _GuidelinesScreenState();
}

class _GuidelinesScreenState extends State<GuidelinesScreen> {
  List<dynamic> _guidelines = [];
  bool _loading = true;
  String? _error;
  String? _expandedId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await GuidelinesService.getGuidelines();
      setState(() { _guidelines = data; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
            ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
            : _guidelines.isEmpty
                ? const Center(child: Text('No guidelines found.'))
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _guidelines.length,
                      itemBuilder: (context, i) {
                        final g = _guidelines[i];
                        final isExpanded = _expandedId == g['id'];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: const Color(0xFFE8EEF7),
                                  child: Text(
                                    '${i + 1}',
                                    style: const TextStyle(color: Color(0xFF1E3A5F), fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                ),
                                title: Text(g['title'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                                subtitle: g['state'] != null
                                    ? Text(g['state'], style: const TextStyle(fontSize: 12))
                                    : null,
                                trailing: Icon(isExpanded ? Icons.expand_less : Icons.expand_more),
                                onTap: () => setState(() => _expandedId = isExpanded ? null : g['id']),
                              ),
                              if (isExpanded) ...[
                                const Divider(height: 1),
                                Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      SelectableText(
                                        g['content'] ?? '—',
                                        style: const TextStyle(fontSize: 13, height: 1.6),
                                      ),
                                      if (g['registry_url'] != null) ...[
                                        const SizedBox(height: 12),
                                        InkWell(
                                          onTap: () async {
                                            final uri = Uri.parse(g['registry_url']);
                                            if (await canLaunchUrl(uri)) launchUrl(uri, mode: LaunchMode.externalApplication);
                                          },
                                          child: Row(
                                            children: [
                                              const Icon(Icons.link, size: 16, color: Colors.blue),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(
                                                  g['registry_url'],
                                                  style: const TextStyle(color: Colors.blue, fontSize: 12, decoration: TextDecoration.underline),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                      if (g['file_url'] != null) ...[
                                        const SizedBox(height: 10),
                                        OutlinedButton.icon(
                                          onPressed: () async {
                                            try {
                                              final url = await GuidelinesService.getDownloadUrl(g['id']);
                                              final uri = Uri.parse(url);
                                              if (await canLaunchUrl(uri)) launchUrl(uri, mode: LaunchMode.externalApplication);
                                            } catch (_) {}
                                          },
                                          icon: const Icon(Icons.picture_as_pdf, size: 16),
                                          label: const Text('Open PDF', style: TextStyle(fontSize: 13)),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
                  );
  }
}
