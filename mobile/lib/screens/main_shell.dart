import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'cases/cases_screen.dart';
import 'deadlines/deadlines_screen.dart';
import 'contacts/contacts_screen.dart';
import 'documents/documents_screen.dart';
import 'guidelines/guidelines_screen.dart';
import 'scanner/scanner_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final _screens = const [
    DeadlinesScreen(),
    CasesScreen(),
    DocumentsScreen(),
    ContactsScreen(),
    GuidelinesScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('LegalAssist'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: PopupMenuButton<String>(
              icon: CircleAvatar(
                backgroundColor: Colors.white24,
                child: Text(
                  (auth.name.isNotEmpty ? auth.name[0] : '?').toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
              onSelected: (value) async {
                if (value == 'logout') await auth.logout();
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  enabled: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(auth.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text(auth.role, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                    ],
                  ),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(value: 'logout', child: Text('Sign out')),
              ],
            ),
          ),
        ],
      ),
      body: _screens[_currentIndex],
      // Hide scan FAB on the Documents tab — that tab has its own create FAB
      floatingActionButton: _currentIndex != 2
          ? FloatingActionButton(
              heroTag: 'scan_fab',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ScannerScreen()),
              ),
              tooltip: 'Scan Document',
              child: const Icon(Icons.document_scanner),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => setState(() => _currentIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.calendar_today_outlined), selectedIcon: Icon(Icons.calendar_today), label: 'Deadlines'),
          NavigationDestination(icon: Icon(Icons.folder_outlined), selectedIcon: Icon(Icons.folder), label: 'Cases'),
          NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description), label: 'Documents'),
          NavigationDestination(icon: Icon(Icons.contacts_outlined), selectedIcon: Icon(Icons.contacts), label: 'Contacts'),
          NavigationDestination(icon: Icon(Icons.menu_book_outlined), selectedIcon: Icon(Icons.menu_book), label: 'Guidelines'),
        ],
      ),
    );
  }
}
