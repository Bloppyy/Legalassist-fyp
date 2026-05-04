import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final _client = Supabase.instance.client;

  User? _user;
  Map<String, dynamic>? _profile;
  bool _isLoading = true;

  bool get isLoading => _isLoading;
  bool get isLoggedIn => _user != null;
  Map<String, dynamic>? get profile => _profile;
  String get role => _profile?['role'] ?? '';
  String get name => _profile?['name'] ?? '';

  void init() {
    _user = _client.auth.currentUser;
    _client.auth.onAuthStateChange.listen((data) async {
      _user = data.session?.user;
      if (_user != null) {
        await _loadProfile();
      } else {
        _profile = null;
      }
      _isLoading = false;
      notifyListeners();
    });

    // Handle initial state if already logged in
    if (_user != null) {
      _loadProfile().then((_) {
        _isLoading = false;
        notifyListeners();
      });
    } else {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _loadProfile() async {
    try {
      final data = await ApiService.get('/users/me');
      _profile = Map<String, dynamic>.from(data);
    } catch (_) {
      _profile = null;
    }
  }

  Future<void> login(String email, String password) async {
    await _client.auth.signInWithPassword(email: email, password: password);
    await _loadProfile();
    notifyListeners();
  }

  Future<void> logout() async {
    await _client.auth.signOut();
    _profile = null;
    notifyListeners();
  }
}
