import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/contacts_service.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  List<dynamic> _contacts = [];
  bool _loading = true;
  String? _error;
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
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ContactsService.getContacts(
        search: _searchCtrl.text.trim().isEmpty ? null : _searchCtrl.text.trim(),
      );
      setState(() { _contacts = data; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  Future<void> _callPhone(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Search contacts…',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searchCtrl.text.isNotEmpty
                  ? IconButton(icon: const Icon(Icons.clear), onPressed: () { _searchCtrl.clear(); _load(); })
                  : null,
              border: const OutlineInputBorder(),
              isDense: true,
            ),
            onSubmitted: (_) => _load(),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                  : _contacts.isEmpty
                      ? const Center(child: Text('No contacts found.'))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            itemCount: _contacts.length,
                            itemBuilder: (context, i) {
                              final c = _contacts[i];
                              final phone = c['phone'] as String?;
                              return Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: const Color(0xFFE8EEF7),
                                    child: Text(
                                      (c['name'] as String? ?? '?')[0].toUpperCase(),
                                      style: const TextStyle(color: Color(0xFF1E3A5F), fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  title: Text(c['name'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                                  subtitle: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (c['job_title'] != null) Text(c['job_title']),
                                      if (c['address'] != null)
                                        Text(c['address'], style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                                    ],
                                  ),
                                  trailing: phone != null
                                      ? IconButton(
                                          icon: const Icon(Icons.phone_outlined, size: 22),
                                          color: const Color(0xFF1E3A5F),
                                          tooltip: phone,
                                          onPressed: () => _callPhone(phone),
                                        )
                                      : null,
                                  onTap: () => _showDetail(context, c),
                                ),
                              );
                            },
                          ),
                        ),
        ),
      ],
    );
  }

  void _showDetail(BuildContext context, Map<String, dynamic> c) {
    final phone = c['phone'] as String?;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(c['name'] ?? '—', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            if (c['job_title'] != null) Text(c['job_title'], style: TextStyle(color: Colors.grey[600])),
            const Divider(height: 24),
            if (phone != null)
              InkWell(
                onTap: () => _callPhone(phone),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Icon(Icons.phone, size: 18, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 10),
                      Text(phone, style: TextStyle(
                        fontSize: 14,
                        color: Theme.of(context).colorScheme.primary,
                        decoration: TextDecoration.underline,
                      )),
                    ],
                  ),
                ),
              ),
            if (c['email'] != null) _DetailRow(Icons.email_outlined, c['email']),
            if (c['address'] != null) _DetailRow(Icons.account_balance_outlined, c['address']),
            if (c['state'] != null) _DetailRow(Icons.location_on_outlined, c['state']),
            if (c['notes'] != null) ...[
              const SizedBox(height: 8),
              _DetailRow(Icons.notes, c['notes']),
            ],
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _DetailRow(this.icon, this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey[600]),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }
}
