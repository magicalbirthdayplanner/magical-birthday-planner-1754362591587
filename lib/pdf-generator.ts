import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PartyData {
  childName: string;
  childAge: string;
  partyDate: Date;
  selectedTheme?: string | null;
  budget?: number;
  zipCode?: string;
  guestCount?: number;
  venue?: 'indoor' | 'outdoor' | 'mixed';
  duration?: string;
}

interface ChecklistItem {
  id: string;
  task: string;
  category: string;
  completed: boolean;
  timeline: string;
  weeksOrDaysBefore?: number;
  dueDate?: Date;
  isOverdue?: boolean;
  status?: 'upcoming' | 'due-soon' | 'overdue' | 'completed';
}

interface Guest {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: 'ADULT' | 'CHILD' | 'FAMILY' | 'COUPLE';
  age?: number;
  notes?: string;
}

interface Invitation {
  id: string;
  guestId: string;
  status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'MAYBE';
  sentAt?: Date;
  respondedAt?: Date;
}

interface BudgetData {
  totalBudget: number;
  categories: {
    name: string;
    budget: number;
    spent: number;
  }[];
}


interface FoodVendor {
  name: string;
  cuisine: string;
  rating?: number;
  specialties?: string[];
  deliveryAvailable?: boolean;
}

const themeData: { [key: string]: any } = {
  superhero: {
    name: "Superhero",
    emoji: "🦸‍♂️",
    colors: ["Red", "Blue", "Yellow", "Silver"],
    decorations: [
      "City skyline backdrops",
      "Comic book speech bubbles",
      "Cape hanging stations",
      "Hero mask crafting table",
      "POW! BOOM! wall decals"
    ],
    food: [
      "Hero sandwiches (cut in lightning bolt shapes)",
      "Power-up fruit kabobs",
      "Blue punch (hero juice)",
      "Captain's shield pizza",
      "Superhero cake with cape topper"
    ]
  },
  princess: {
    name: "Princess",
    emoji: "👸",
    colors: ["Pink", "Purple", "Gold", "Silver"],
    decorations: [
      "Castle backdrop",
      "Flowing fabric drapes",
      "Crown centerpieces",
      "Fairy lights everywhere",
      "Royal throne chair"
    ],
    food: [
      "Royal tea sandwiches",
      "Princess punch in fancy cups",
      "Crown-shaped cookies",
      "Castle cake",
      "Pink lemonade in goblets"
    ]
  },
  dinosaur: {
    name: "Dinosaur",
    emoji: "🦕",
    colors: ["Green", "Brown", "Orange", "Yellow"],
    decorations: [
      "Jungle backdrop",
      "Dinosaur footprints",
      "Volcano centerpieces",
      "Fossil dig station",
      "Prehistoric plants"
    ],
    food: [
      "Dino nuggets",
      "Prehistoric punch",
      "Fossil cookies",
      "Volcano cake",
      "Caveman fruit"
    ]
  },
  space: {
    name: "Space",
    emoji: "🚀",
    colors: ["Blue", "Purple", "Silver", "Black"],
    decorations: [
      "Galaxy backdrop",
      "Hanging planets",
      "Rocket ship centerpieces",
      "Astronaut helmets",
      "LED star lights"
    ],
    food: [
      "Galaxy pizza",
      "Cosmic smoothies",
      "Planet cookies",
      "Rocket ship cake",
      "Astronaut ice cream"
    ]
  }
};

export function generatePartyPlanPDF(
  partyData: PartyData,
  checklist: ChecklistItem[],
  guests: Guest[],
  invitations: Invitation[] = [],
  budgetData?: BudgetData,
  foodVendors?: FoodVendor[]
) {
  const doc = new jsPDF();
  let yPosition = 20;
  
  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('🎉 Party Plan', 20, yPosition);
  
  yPosition += 15;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text(`${partyData.childName}'s ${partyData.selectedTheme || 'Birthday'} Party`, 20, yPosition);
  
  yPosition += 20;
  
  // Party Overview Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Party Overview', 20, yPosition);
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const overviewData = [
    ['Child Name', partyData.childName],
    ['Age', partyData.childAge],
    ['Party Date', partyData.partyDate.toLocaleDateString()],
    ['Theme', partyData.selectedTheme || 'No theme selected'],
    ['Guest Count', partyData.guestCount?.toString() || 'Not specified'],
    ['Venue Type', partyData.venue || 'Not specified'],
    ['Duration', partyData.duration || 'Not specified'],
    ['Budget', partyData.budget ? `$${partyData.budget}` : 'Not specified'],
    ['Location', partyData.zipCode || 'Not specified']
  ];
  
  autoTable(doc, {
    startY: yPosition,
    head: [['Detail', 'Information']],
    body: overviewData,
    theme: 'grid',
    headStyles: { fillColor: [139, 69, 19] },
    margin: { left: 20, right: 20 }
  });
  
  yPosition = (doc as any).lastAutoTable.finalY + 20;
  
  // Theme Details Section
  const selectedThemeData = partyData.selectedTheme ? themeData[partyData.selectedTheme.toLowerCase()] : null;
  if (selectedThemeData) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Theme Details', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Theme colors
    doc.text('Colors: ' + selectedThemeData.colors.join(', '), 20, yPosition);
    yPosition += 8;
    
    // Decorations
    doc.text('Decorations:', 20, yPosition);
    yPosition += 6;
    selectedThemeData.decorations.forEach((decoration: string) => {
      doc.text('• ' + decoration, 25, yPosition);
      yPosition += 5;
    });
    
    yPosition += 5;
    
    // Food suggestions
    doc.text('Food Ideas:', 20, yPosition);
    yPosition += 6;
    selectedThemeData.food.forEach((food: string) => {
      doc.text('• ' + food, 25, yPosition);
      yPosition += 5;
    });
    
    yPosition += 15;
  }
  
  // Budget Section
  if (budgetData && budgetData.totalBudget > 0) {
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Budget Breakdown', 20, yPosition);
    yPosition += 10;
    
    const budgetTableData = budgetData.categories.map(category => [
      category.name,
      `$${category.budget}`,
      `$${category.spent}`,
      `$${category.budget - category.spent}`
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Category', 'Budget', 'Spent', 'Remaining']],
      body: budgetTableData,
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94] },
      margin: { left: 20, right: 20 }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Budget: $${budgetData.totalBudget}`, 20, yPosition);
    yPosition += 15;
  }
  
  // Guest List Section
  if (guests.length > 0) {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Guest List', 20, yPosition);
    yPosition += 10;
    
    const guestTableData = guests.map(guest => {
      const invitation = invitations.find(inv => inv.guestId === guest.id);
      const rsvpStatus = invitation?.status || 'PENDING';
      return [
        guest.name,
        guest.type,
        guest.email || 'N/A',
        guest.phone || 'N/A',
        rsvpStatus.charAt(0).toUpperCase() + rsvpStatus.slice(1).toLowerCase()
      ];
    });
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Name', 'Type', 'Email', 'Phone', 'RSVP Status']],
      body: guestTableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 20 },
        2: { cellWidth: 45 },
        3: { cellWidth: 35 },
        4: { cellWidth: 25 }
      }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 15;
    
    // RSVP Summary
    const rsvpSummary = guests.reduce((acc, guest) => {
      const invitation = invitations.find(inv => inv.guestId === guest.id);
      const status = invitation?.status?.toLowerCase() || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Guests: ${guests.length}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Accepted: ${rsvpSummary.accepted || 0} | Declined: ${rsvpSummary.declined || 0} | Pending: ${rsvpSummary.pending || 0}`, 20, yPosition);
    yPosition += 15;
  }
  
  
  // Food Vendors Section
  if (foodVendors && foodVendors.length > 0) {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Food Vendor Options', 20, yPosition);
    yPosition += 10;
    
    const foodTableData = foodVendors.slice(0, 10).map(vendor => [
      vendor.name,
      vendor.cuisine,
      vendor.rating ? vendor.rating.toString() : 'N/A',
      vendor.deliveryAvailable ? 'Yes' : 'No',
      vendor.specialties ? vendor.specialties.slice(0, 2).join(', ') : 'N/A'
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Vendor', 'Cuisine', 'Rating', 'Delivery', 'Specialties']],
      body: foodTableData,
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68] },
      margin: { left: 20, right: 20 }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Checklist Section with checkboxes
  if (checklist.length > 0) {
    doc.addPage();
    yPosition = 20;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Party Planning Checklist', 20, yPosition);
    yPosition += 15;
    
    // Group checklist by timeline
    const groupedChecklist = checklist.reduce((acc, item) => {
      if (!acc[item.timeline]) {
        acc[item.timeline] = [];
      }
      acc[item.timeline].push(item);
      return acc;
    }, {} as Record<string, ChecklistItem[]>);
    
    Object.entries(groupedChecklist).forEach(([timeline, items]) => {
      if (yPosition > 260) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(timeline, 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      items.forEach(item => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Draw checkbox
        const checkboxSize = 3;
        doc.rect(20, yPosition - 2, checkboxSize, checkboxSize);
        
        // Fill checkbox if completed
        if (item.completed) {
          doc.setFillColor(0, 0, 0);
          doc.rect(20.5, yPosition - 1.5, checkboxSize - 1, checkboxSize - 1, 'F');
          doc.setFillColor(255, 255, 255); // Reset fill color
        }
        
        // Task text
        const taskText = item.task;
        doc.text(taskText, 28, yPosition);
        
        // Due date if available
        if (item.dueDate) {
          const dueDateText = `(Due: ${item.dueDate.toLocaleDateString()})`;
          doc.setFont('helvetica', 'italic');
          doc.text(dueDateText, 28, yPosition + 4);
          doc.setFont('helvetica', 'normal');
          yPosition += 4;
        }
        
        yPosition += 8;
      });
      
      yPosition += 5;
    });
  }
  
  // Footer with generation date
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${pageCount}`, 20, 285);
  }
  
  return doc;
}