import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface DateInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDisplayDate(dateStr: string): { month: number; day: number; year: number } | null {
  if (!dateStr) return null;
  
  const monthMatch = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})?$/i);
  if (monthMatch) {
    const monthIndex = MONTH_ABBR.findIndex(m => m.toLowerCase() === monthMatch[1].toLowerCase());
    const day = parseInt(monthMatch[2], 10);
    const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : new Date().getFullYear();
    if (monthIndex >= 0 && day >= 1 && day <= 31) {
      return { month: monthIndex, day, year };
    }
  }
  
  const numericMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1], 10) - 1;
    const day = parseInt(numericMatch[2], 10);
    let year = parseInt(numericMatch[3], 10);
    if (year < 100) year += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return { month, day, year };
    }
  }
  
  return null;
}

export function DateInput({ label, value, onChangeText, placeholder = 'MMM DD, YYYY' }: DateInputProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const parsed = parseDisplayDate(value);
    return parsed ? new Date(parsed.year, parsed.month, 1) : new Date();
  });

  const formatToDisplay = useCallback((month: number, day: number, year: number): string => {
    return `${MONTH_ABBR[month]} ${String(day).padStart(2, '0')}, ${year}`;
  }, []);

  const handleDateSelect = useCallback((day: number) => {
    const month = displayMonth.getMonth();
    const year = displayMonth.getFullYear();
    const formatted = formatToDisplay(month, day, year);
    onChangeText(formatted);
    setShowPicker(false);
  }, [displayMonth, formatToDisplay, onChangeText]);

  const handlePrevMonth = useCallback(() => {
    setDisplayMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setDisplayMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
  }, [onChangeText]);

  const handleOpenPicker = useCallback(() => {
    const parsed = parseDisplayDate(value);
    if (parsed) {
      setDisplayMonth(new Date(parsed.year, parsed.month, 1));
    } else {
      setDisplayMonth(new Date());
    }
    setShowPicker(true);
  }, [value]);

  const getDaysInMonth = useCallback((date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }, []);

  const getFirstDayOfMonth = useCallback((date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }, []);

  const renderCalendar = useCallback(() => {
    const daysInMonth = getDaysInMonth(displayMonth);
    const firstDay = getFirstDayOfMonth(displayMonth);
    const weeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    const parsed = parseDisplayDate(value);
    const selectedDay = parsed?.month === displayMonth.getMonth() && parsed?.year === displayMonth.getFullYear() ? parsed.day : null;
    const today = new Date();
    const isCurrentMonth = today.getMonth() === displayMonth.getMonth() && today.getFullYear() === displayMonth.getFullYear();

    return weeks.map((week, weekIndex) => (
      <View key={weekIndex} style={styles.calendarWeek}>
        {week.map((day, dayIndex) => {
          const isSelected = day === selectedDay;
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <TouchableOpacity
              key={dayIndex}
              style={[
                styles.calendarDay,
                isSelected && styles.calendarDaySelected,
                isToday && !isSelected && styles.calendarDayToday,
              ]}
              onPress={() => day && handleDateSelect(day)}
              disabled={!day}
            >
              <Text style={[
                styles.calendarDayText,
                !day && styles.calendarDayTextEmpty,
                isSelected && styles.calendarDayTextSelected,
                isToday && !isSelected && styles.calendarDayTextToday,
              ]}>
                {day || ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ));
  }, [displayMonth, value, getDaysInMonth, getFirstDayOfMonth, handleDateSelect]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.light.textSecondary}
        />
        <TouchableOpacity style={styles.calendarButton} onPress={handleOpenPicker}>
          <Calendar size={20} color={Colors.light.tint} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                <ChevronLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
              <Text style={styles.monthYearText}>
                {MONTHS[displayMonth.getMonth()]} {displayMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                <ChevronRight size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarDaysHeader}>
              {DAYS.map(day => (
                <View key={day} style={styles.calendarDayHeader}>
                  <Text style={styles.calendarDayHeaderText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.calendarBody}>
              {renderCalendar()}
            </View>

            <View style={styles.pickerFooter}>
              <TouchableOpacity 
                style={styles.todayButton}
                onPress={() => {
                  const today = new Date();
                  const formatted = formatToDisplay(today.getMonth(), today.getDate(), today.getFullYear());
                  onChangeText(formatted);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.todayButtonText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => {
                  onChangeText('');
                  setShowPicker(false);
                }}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    fontSize: 15,
    color: Colors.light.text,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  },
  calendarButton: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContainer: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  navButton: {
    padding: 4,
  },
  monthYearText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  calendarDaysHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  calendarDayHeader: {
    flex: 1,
    alignItems: 'center',
  },
  calendarDayHeaderText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  calendarBody: {
    padding: 8,
  },
  calendarWeek: {
    flexDirection: 'row',
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 2,
  },
  calendarDaySelected: {
    backgroundColor: Colors.light.tint,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: Colors.light.tint,
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  calendarDayTextEmpty: {
    color: 'transparent',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '700' as const,
  },
  calendarDayTextToday: {
    color: Colors.light.tint,
    fontWeight: '700' as const,
  },
  pickerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 12,
  },
  todayButton: {
    flex: 1,
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  clearButton: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
});
