export const formatDate = (dateString: string): string => {
  if (!dateString || typeof dateString !== 'string') return 'N/A';
  const trimmed = dateString.trim();
  if (!trimmed || trimmed.length < 2) return 'N/A';
  try {
    const date = new Date(trimmed.replace(/-/g, '/'));
    if (isNaN(date.getTime())) {
      return trimmed.length > 1 ? trimmed : 'N/A';
    }
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  } catch {
    return trimmed.length > 1 ? trimmed : 'N/A';
  }
};

export const parseAndFormatDate = (input: string): string => {
  if (!input) return '';
  
  const currentYear = new Date().getFullYear();
  let month: number | null = null;
  let day: number | null = null;
  let year: number = currentYear;

  const cleanedInput = input.replace(/[^0-9a-zA-Z/.-]/g, '').trim();
  
  const monthNames: { [key: string]: number } = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
  };

  const monthMatch = cleanedInput.toLowerCase().match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (monthMatch) {
    month = monthNames[monthMatch[1].toLowerCase()];
    const rest = cleanedInput.slice(3).replace(/[^0-9]/g, '');
    if (rest.length >= 2) {
      day = parseInt(rest.slice(0, 2), 10);
      if (rest.length >= 4) {
        const yearPart = rest.slice(2);
        year = yearPart.length === 2 ? 2000 + parseInt(yearPart, 10) : parseInt(yearPart, 10);
      }
    }
  } else {
    const numericMatch = cleanedInput.match(/^(\d{1,2})[./](\d{1,2})[./]?(\d{2,4})?$/);
    if (numericMatch) {
      month = parseInt(numericMatch[1], 10);
      day = parseInt(numericMatch[2], 10);
      if (numericMatch[3]) {
        year = numericMatch[3].length === 2 ? 2000 + parseInt(numericMatch[3], 10) : parseInt(numericMatch[3], 10);
      }
    }
  }

  if (month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    const dateObj = new Date(year, month - 1, day);
    if (!isNaN(dateObj.getTime())) {
      return formatDate(dateObj.toISOString());
    }
  }

  return input;
};

export const toTitleCase = (text: string): string => {
  return text
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

export const applyTitleCaseOnSpace = (
  newText: string,
  previousText: string
): string => {
  if (newText.length > previousText.length && newText.endsWith(' ')) {
    return toTitleCase(newText);
  }
  return newText;
};
