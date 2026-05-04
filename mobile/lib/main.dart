import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'providers/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/main_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: 'https://zgsetdaolvqlxufwtydb.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpnc2V0ZGFvbHZxbHh1Znd0eWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzUwNDQsImV4cCI6MjA5MTQ1MTA0NH0.fMEQenGpaCiQDSf8jziVyEOkkyjxKVzJrvDqIeSCbxA',
  );

  runApp(const LegalAssistApp());
}

class LegalAssistApp extends StatelessWidget {
  const LegalAssistApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider()..init(),
      child: MaterialApp(
        title: 'LegalAssist',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF1E3A5F),
            primary: const Color(0xFF1E3A5F),
          ),
          useMaterial3: true,
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF1E3A5F),
            foregroundColor: Colors.white,
            elevation: 0,
          ),
        ),
        home: const _RootRouter(),
      ),
    );
  }
}

class _RootRouter extends StatelessWidget {
  const _RootRouter();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return auth.isLoggedIn ? const MainShell() : const LoginScreen();
  }
}
