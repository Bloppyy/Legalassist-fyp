import 'package:flutter/material.dart';

class TemplateDetailScreen extends StatelessWidget {
  final Map<String, dynamic> template;
  const TemplateDetailScreen({super.key, required this.template});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(template['title'] ?? 'Template')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (template['category'] != null)
            Chip(label: Text(template['category']['name'])),
          if (template['instructions'] != null) ...[
            const SizedBox(height: 12),
            Text('Instructions', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber[200]!),
              ),
              child: Text(template['instructions'], style: const TextStyle(fontSize: 13)),
            ),
          ],
          const SizedBox(height: 16),
          Text('Content', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey[300]!),
            ),
            child: SelectableText(
              template['content'] ?? '(no content)',
              style: const TextStyle(fontSize: 13, height: 1.6),
            ),
          ),
        ],
      ),
    );
  }
}
