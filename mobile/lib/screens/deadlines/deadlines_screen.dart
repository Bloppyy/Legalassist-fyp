import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../services/deadlines_service.dart';

class DeadlinesScreen extends StatefulWidget {
  const DeadlinesScreen({super.key});

  @override
  State<DeadlinesScreen> createState() => _DeadlinesScreenState();
}

class _DeadlinesScreenState extends State<DeadlinesScreen> with SingleTickerProviderStateMixin {
  List<dynamic> _deadlines = [];
  bool _loading = true;
  String? _error;
  bool _upcomingOnly = false;

  late TabController _tabController;

  // Calendar state
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;
  Map<DateTime, List<dynamic>> _events = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await DeadlinesService.getDeadlines(upcomingOnly: _upcomingOnly);
      final events = <DateTime, List<dynamic>>{};
      for (final d in data) {
        final date = DateTime.parse(d['deadline_date']).toLocal();
        final key = DateTime(date.year, date.month, date.day);
        events.putIfAbsent(key, () => []).add(d);
      }
      setState(() { _deadlines = data; _events = events; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  bool _isOverdue(String dateStr, bool completed) {
    if (completed) return false;
    return DateTime.parse(dateStr).isBefore(DateTime.now());
  }

  List<dynamic> _getEventsForDay(DateTime day) {
    return _events[DateTime(day.year, day.month, day.day)] ?? [];
  }

  List<dynamic> get _selectedDeadlines {
    if (_selectedDay == null) return [];
    return _getEventsForDay(_selectedDay!);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.list), text: 'List'),
            Tab(icon: Icon(Icons.calendar_month), text: 'Calendar'),
          ],
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildListView(),
                        _buildCalendarView(),
                      ],
                    ),
        ),
      ],
    );
  }

  Widget _buildListView() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              const Text('Upcoming only'),
              const SizedBox(width: 8),
              Switch(
                value: _upcomingOnly,
                onChanged: (v) { setState(() => _upcomingOnly = v); _load(); },
              ),
              const Spacer(),
              IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
            ],
          ),
        ),
        Expanded(
          child: _deadlines.isEmpty
              ? const Center(child: Text('No deadlines found.'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _deadlines.length,
                    itemBuilder: (context, i) => _buildDeadlineTile(_deadlines[i]),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildCalendarView() {
    return Column(
      children: [
        TableCalendar(
          firstDay: DateTime.utc(2020, 1, 1),
          lastDay: DateTime.utc(2030, 12, 31),
          focusedDay: _focusedDay,
          selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
          eventLoader: _getEventsForDay,
          calendarStyle: CalendarStyle(
            markerDecoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              shape: BoxShape.circle,
            ),
            selectedDecoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              shape: BoxShape.circle,
            ),
            todayDecoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.4),
              shape: BoxShape.circle,
            ),
          ),
          headerStyle: const HeaderStyle(
            formatButtonVisible: false,
            titleCentered: true,
          ),
          onDaySelected: (selectedDay, focusedDay) {
            setState(() {
              _selectedDay = selectedDay;
              _focusedDay = focusedDay;
            });
          },
          onPageChanged: (focusedDay) {
            _focusedDay = focusedDay;
          },
        ),
        const Divider(height: 1),
        if (_selectedDay != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                DateFormat('d MMMM yyyy').format(_selectedDay!),
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          ),
        Expanded(
          child: _selectedDeadlines.isEmpty
              ? Center(
                  child: Text(
                    _selectedDay == null ? 'Tap a date to see deadlines' : 'No deadlines on this day',
                    style: TextStyle(color: Colors.grey[500]),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  itemCount: _selectedDeadlines.length,
                  itemBuilder: (context, i) => _buildDeadlineTile(_selectedDeadlines[i]),
                ),
        ),
      ],
    );
  }

  Future<void> _toggleComplete(String id) async {
    try {
      await DeadlinesService.toggleComplete(id);
      _load();
    } catch (_) {}
  }

  Widget _buildDeadlineTile(Map<String, dynamic> d) {
    final overdue = _isOverdue(d['deadline_date'], d['is_completed'] == true);
    final completed = d['is_completed'] == true;
    final date = DateFormat('d MMM yyyy').format(DateTime.parse(d['deadline_date']));
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: completed
              ? Colors.green[100]
              : overdue ? Colors.red[100] : Colors.blue[100],
          child: Icon(
            completed ? Icons.check : overdue ? Icons.warning_amber : Icons.calendar_today,
            color: completed ? Colors.green[700] : overdue ? Colors.red[700] : Colors.blue[700],
            size: 20,
          ),
        ),
        title: Text(d['title'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (d['category'] != null)
              Text(
                (d['category'] as String).replaceAll('_', ' '),
                style: TextStyle(fontSize: 12, color: Colors.blue[700], fontWeight: FontWeight.w500),
              ),
            if (d['court_name'] != null && (d['court_name'] as String).isNotEmpty)
              Text(d['court_name'], style: const TextStyle(fontSize: 12)),
            Text(
              date,
              style: TextStyle(
                color: overdue ? Colors.red[700] : Colors.grey[600],
                fontWeight: overdue ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            if (d['case_file'] != null)
              Text('Case: ${d['case_file']['case_number']}', style: const TextStyle(fontSize: 12)),
            if (d['remarks'] != null && (d['remarks'] as String).isNotEmpty)
              Text(d['remarks'], style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
        trailing: IconButton(
          tooltip: completed ? 'Mark incomplete' : 'Mark complete',
          icon: Icon(
            completed ? Icons.check_circle : Icons.radio_button_unchecked,
            color: completed ? Colors.green[600] : Colors.grey[400],
            size: 28,
          ),
          onPressed: () => _toggleComplete(d['id']),
        ),
      ),
    );
  }
}
