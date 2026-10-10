import { Assignment, Exam, Folder } from '../types';

export const COURSE_COLORS: Record<string, string> = {
  'CS 111': '#1f5c4d', // pine green
  'MATH 151': '#2c6bd6', // royal blue
  'PHYS 203': '#d9482b', // rust orange
  'ENG 101': '#7b4fd1', // purple
  'BIO 110': '#0f8a85', // teal
  'Other': '#a86f00', // amber
  'General': '#5d6d70', // slate
};

export function getCourseColor(course: string): string {
  return COURSE_COLORS[course] || '#1f5c4d';
}

export function generateInitialAssignments(): Assignment[] {
  const now = new Date();
  const startOfDay = (daysOffset: number, hours = 23, minutes = 59) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  return [
    {
      uid: 'assign-1',
      title: 'Lab 4: Recursion & Trees',
      course: 'CS 111',
      start: startOfDay(0, 23, 59), // Today
      all: false,
      desc: 'Implement binary search tree traversal and self-balancing rotation functions in Python.',
      url: 'https://canvas.instructure.com/courses/cs111/assignments/lab4',
      type: 'a',
      weight: 15,
      completed: false,
      priorityRank: 2,
      priorityScore: 92,
      estimatedHours: 2.5,
      urgency: 'HIGH',
      geminiReason: 'Due tonight at 11:59 PM. Worth 15% of your practical grade—finish tree rotations first.',
      recommendedSlot: 'Today 5:00 PM - 7:30 PM',
    },
    {
      uid: 'assign-2',
      title: 'Problem Set 6: Multivariable Integrals',
      course: 'MATH 151',
      start: startOfDay(1, 18, 0), // Tomorrow
      all: false,
      desc: 'Solve double integrals over polar regions, textbook exercises 14.1 through 14.4.',
      url: 'https://canvas.instructure.com/courses/math151/assignments/ps6',
      type: 'a',
      weight: 20,
      completed: false,
      priorityRank: 1,
      priorityScore: 96,
      estimatedHours: 3.5,
      urgency: 'CRITICAL',
      geminiReason: 'Heaviest active homework weight (20%) with strict no-extension policy.',
      recommendedSlot: 'Tonight 8:00 PM - 10:30 PM',
    },
    {
      uid: 'assign-3',
      title: 'Physics Lab Report: Pendulum Mechanics',
      course: 'PHYS 203',
      start: startOfDay(2, 17, 0),
      all: false,
      desc: 'Analyze dampening factor experimental data and plot damping ratio graphs in Excel or Python.',
      url: 'https://canvas.instructure.com/courses/phys203/assignments/lab-report',
      type: 'a',
      weight: 15,
      completed: false,
      priorityRank: 3,
      priorityScore: 78,
      estimatedHours: 2.0,
      urgency: 'MEDIUM',
      geminiReason: 'Moderate urgency. Lab calculations are mostly automated.',
      recommendedSlot: 'Tomorrow 2:00 PM - 4:00 PM',
    },
    {
      uid: 'assign-4',
      title: 'Reading Quiz 5: Romantic Era Poetry',
      course: 'ENG 101',
      start: startOfDay(2, 9, 0),
      all: false,
      desc: 'Ten quick comprehension questions on Wordsworth & Keats chapters 7-8.',
      url: 'https://canvas.instructure.com/courses/eng101/quizzes/5',
      type: 'a',
      weight: 5,
      completed: false,
      priorityRank: 5,
      priorityScore: 65,
      estimatedHours: 0.75,
      urgency: 'LOW',
      geminiReason: 'Quick win (5% weight). 30-minute skim before bedtime recommended.',
      recommendedSlot: 'Tomorrow 9:00 PM - 9:45 PM',
    },
    {
      uid: 'assign-5',
      title: 'Essay Draft 2: Environmental Justice Case Study',
      course: 'ENG 101',
      start: startOfDay(4, 23, 59),
      all: false,
      desc: '1,500 words MLA formatted research argument with at least 5 scholarly peer-reviewed citations.',
      url: 'https://canvas.instructure.com/courses/eng101/assignments/essay-draft-2',
      type: 'a',
      weight: 25,
      completed: false,
      priorityRank: 4,
      priorityScore: 84,
      estimatedHours: 4.0,
      urgency: 'MEDIUM',
      geminiReason: 'High weight (25%). Outline and thesis already drafted; needs paragraph synthesis.',
      recommendedSlot: 'In 2 days 1:00 PM - 5:00 PM',
    },
    {
      uid: 'assign-6',
      title: 'Homework 3: Graph Traversal & Dijkstra',
      course: 'CS 111',
      start: startOfDay(6, 23, 59),
      all: false,
      desc: 'Implement shortest-path algorithm using priority queues.',
      url: 'https://canvas.instructure.com/courses/cs111/assignments/hw3',
      type: 'a',
      weight: 15,
      completed: false,
      priorityRank: 6,
      priorityScore: 60,
      estimatedHours: 3.0,
      urgency: 'LOW',
      geminiReason: 'Upcoming next week. Review graph adjacency lists after finishing Lab 4.',
      recommendedSlot: 'Weekend study block',
    },
    {
      uid: 'assign-7',
      title: 'Midterm Exam: Chapters 1 to 6',
      course: 'PHYS 203',
      start: startOfDay(10, 10, 0),
      all: false,
      desc: 'Covers kinematics, Newton laws, momentum, and harmonic oscillations. Scientific calculator permitted.',
      url: 'https://canvas.instructure.com/courses/phys203/exams/midterm',
      type: 'a',
      weight: 30,
      completed: false,
      priorityRank: 7,
      priorityScore: 70,
      estimatedHours: 8.0,
      urgency: 'MEDIUM',
      geminiReason: 'Crucial 30% exam. Begin flashcards and unit practice problem sets now.',
      recommendedSlot: 'Daily 1-hour review',
    },
  ];
}

export function generateInitialExams(): Exam[] {
  const now = new Date();
  const futureDate = (days: number, hour = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  return [
    {
      id: 'exam-1',
      title: 'PHYS 203 Midterm Examination',
      course: 'PHYS 203',
      date: futureDate(10, 10),
      weight: 30,
      location: 'Science Hall Lecture C (Room 102)',
      topics: ['Kinematics & Projectile Motion', 'Newtonian Force Laws', 'Work, Energy & Momentum', 'Harmonic Oscillators'],
    },
    {
      id: 'exam-2',
      title: 'MATH 151 Midterm Exam 2',
      course: 'MATH 151',
      date: futureDate(17, 14),
      weight: 30,
      location: 'Mathematics Tower 304',
      topics: ['Double & Triple Integrals', 'Vector Fields', 'Line Integrals', "Green's Theorem"],
    },
    {
      id: 'exam-3',
      title: 'CS 111 Midterm Coding Practical',
      course: 'CS 111',
      date: futureDate(24, 11),
      weight: 25,
      location: 'Turing Computer Lab (Station 14)',
      topics: ['Asymptotic Analysis (Big-O)', 'Trees & Binary Search', 'Hash Tables & Collisions', 'Graph DFS/BFS'],
    },
    {
      id: 'exam-4',
      title: 'ENG 101 Final Portfolio Defense',
      course: 'ENG 101',
      date: futureDate(35, 13),
      weight: 35,
      location: 'Humanities Hall 202',
      topics: ['Argumentative Rhetoric', 'Peer Review Synthesis', 'Annotated Bibliography'],
    },
  ];
}

export function generateInitialFolders(): Folder[] {
  return [
    {
      id: 'folder-fall-26',
      name: 'Fall Sem 26',
      classes: [
        {
          id: 'class-1',
          name: 'Class 1 - CS 111: Data Structures',
          code: 'CS 111',
          instructor: 'Prof. Ada Lovelace',
          color: '#1f5c4d',
          folderId: 'folder-fall-26',
          units: [
            {
              id: 'unit-1',
              name: 'Unit 1: Asymptotic Runtime (Big-O)',
              notes: `Big-O Notation Fundamentals:
- Defines upper-bound asymptotic growth of algorithms.
- Common complexities:
  O(1) Constant: Array index lookup, Hash map ideal lookup.
  O(log n) Logarithmic: Binary search on sorted arrays.
  O(n) Linear: Linear search, single loop through array.
  O(n log n) Linearithmic: MergeSort, HeapSort, QuickSort (average).
  O(n²) Quadratic: Nested loops, BubbleSort, SelectionSort.
  O(2ⁿ) Exponential: Naive Fibonacci recursion.

Master Theorem for divide-and-conquer recurrences:
T(n) = aT(n/b) + f(n)
Comparing f(n) with n^(log_b(a)) determines dominant term.`,
              studyGuide: {
                summary: 'Unit 1 covers algorithm complexity evaluation using Big-O, Big-Omega, and Big-Theta notation alongside the Master Theorem.',
                keyConcepts: [
                  'Upper bound Big-O vs lower bound Big-Omega vs tight bound Big-Theta',
                  'Space complexity includes auxiliary memory and recursion call stack depth',
                  'Master Theorem cases for recursive recurrence relations',
                ],
                cheatSheet: '• Binary Search: O(log n) time, O(1) space\n• MergeSort: O(n log n) time, O(n) space\n• QuickSort worst case: O(n²) if pivot is extreme',
                commonPitfalls: ['Ignoring call stack frames in recursive space complexity', 'Assuming QuickSort is always O(n log n) without randomized pivot'],
                reviewQuestions: [
                  'What is the recurrence relation for MergeSort and how does Master Theorem solve it?',
                  'Why does binary search require random access in O(1) to achieve O(log n)?',
                ],
              },
            },
            {
              id: 'unit-2',
              name: 'Unit 2: Recursion & Backtracking',
              notes: `Recursion Core Mechanics:
1. Base Case: The terminating condition that prevents infinite call stacks.
2. Recursive Step: Breaking problem down into strictly smaller subproblems.
3. Call Stack Lifecycle: Each recursive invocation allocates a stack frame holding local variables and return address.

Backtracking Pattern:
- Choose -> Explore -> Unchoose (Backtrack).
- Classic applications: N-Queens, Sudoku Solver, Subset Sum, Graph coloring.
- Pruning: Checking constraints early to cut off non-viable recursion branches before exploring deeply.`,
            },
            {
              id: 'unit-3',
              name: 'Unit 3: Trees & Binary Search Trees',
              notes: `Tree Hierarchies:
- Binary Tree: Each node has at most 2 children (left, right).
- BST Invariant: Left subtree keys < Node key < Right subtree keys.
- Traversals:
  * In-Order (Left, Root, Right): Visits BST nodes in ascending sorted order!
  * Pre-Order (Root, Left, Right): Useful for tree cloning and serialization.
  * Post-Order (Left, Right, Root): Useful for bottom-up deletion and expression evaluation.
  * Level-Order (BFS): Queue-based breadth first traversal.
- Self-Balancing Trees (AVL & Red-Black):
  Maintain height O(log n) via tree rotations (Left Rotation, Right Rotation, Left-Right, Right-Left).`,
            },
            {
              id: 'unit-4',
              name: 'Unit 4: Hash Tables & Heaps',
              notes: `Hash Tables:
- Key -> Hash Function -> Array Index.
- Collision Resolution:
  1. Chaining: Linked lists or balanced trees at each bucket.
  2. Open Addressing: Linear probing, quadratic probing, double hashing.
- Load Factor α = n / m (items / buckets). Rehash when α > 0.75.

Binary Heaps & Priority Queues:
- Complete binary tree represented as flat array:
  Parent(i) = (i - 1) // 2
  LeftChild(i) = 2*i + 1, RightChild(i) = 2*i + 2
- Max Heap: Parent >= Children.
- Insert: Append to end, bubble-up (O(log n)).
- Extract Max: Swap root with end, bubble-down (O(log n)).`,
            },
            {
              id: 'unit-5',
              name: 'Unit 5: Graphs & Dijkstra Algorithm',
              notes: `Graph Representations:
- Adjacency Matrix: Space O(V²), O(1) edge lookup.
- Adjacency List: Space O(V + E), ideal for sparse graphs.

Shortest Path Algorithms:
- BFS: Shortest path in unweighted graphs (O(V + E)).
- Dijkstra: Non-negative edge weights using Min-Heap (O((V + E) log V)).
- Bellman-Ford: Handles negative weights and detects negative cycles (O(V * E)).`,
            },
          ],
        },
        {
          id: 'class-2',
          name: 'Class 2 - MATH 151: Calculus',
          code: 'MATH 151',
          instructor: 'Dr. Katherine Johnson',
          color: '#2c6bd6',
          folderId: 'folder-fall-26',
          units: [
            {
              id: 'unit-math-1',
              name: 'Unit 1: Vectors & Dot/Cross Products',
              notes: `Vector Geometry in 3D:
- Dot Product: u · v = |u||v|cos(θ). Used for projection and testing orthogonality (u · v = 0).
- Cross Product: u × v = determinant matrix. Yields orthogonal vector. Magnitude |u × v| equals area of parallelogram!
- Equation of a Plane: a(x - x₀) + b(y - y₀) + c(z - z₀) = 0, where n = <a, b, c> is the normal vector.`,
            },
            {
              id: 'unit-math-2',
              name: 'Unit 2: Partial Derivatives & Gradients',
              notes: `Multivariable Functions:
- Gradient ∇f = <∂f/∂x, ∂f/∂y, ∂f/∂z>.
- Directional derivative D_u f = ∇f · u (where u is unit vector).
- Gradient points in direction of maximum rate of increase; magnitude is that max rate!
- Tangent plane to level surface f(x, y, z) = k at (x₀, y₀, z₀): ∇f · <x-x₀, y-y₀, z-z₀> = 0.`,
            },
            {
              id: 'unit-math-3',
              name: 'Unit 3: Multiple Integrals',
              notes: `Double & Triple Integrals:
- Double integral over region R: ∬_R f(x, y) dA.
- Polar coordinates: dA = r dr dθ.
- Cylindrical coordinates: dV = r dr dθ dz.
- Spherical coordinates: dV = ρ² sin(φ) dρ dφ dθ.`,
            },
            {
              id: 'unit-math-4',
              name: 'Unit 4: Vector Calculus & Green Theorem',
              notes: `Line Integrals & Vector Fields:
- Work done: W = ∫_C F · dr.
- Conservative vector field: F = ∇f. Path independent!
- Green's Theorem: ∮_C (P dx + Q dy) = ∬_D (∂Q/∂x - ∂P/∂y) dA. Connects boundary line integral to interior double integral.`,
            },
            {
              id: 'unit-math-5',
              name: 'Unit 5: Divergence & Stokes Theorem',
              notes: `Flux and Circulation:
- Divergence: div F = ∇ · F (measures source/sink strength).
- Curl: curl F = ∇ × F (measures rotation).
- Stokes' Theorem: ∮_C F · dr = ∬_S (curl F) · dS.
- Divergence Theorem: ∬_S F · dS = ∭_E (div F) dV.`,
            },
          ],
        },
        {
          id: 'class-3',
          name: 'Class 3 - PHYS 203: Physics',
          code: 'PHYS 203',
          instructor: 'Dr. Richard Feynman',
          color: '#d9482b',
          folderId: 'folder-fall-26',
          units: [
            {
              id: 'unit-phys-1',
              name: 'Unit 1: Kinematics & Newton Laws',
              notes: `Classical Mechanics:
- Position, velocity v(t) = dx/dt, acceleration a(t) = dv/dt.
- Newton 1st: Inertia.
- Newton 2nd: F_net = dp/dt = m*a.
- Newton 3rd: Equal and opposite action-reaction pairs.
- Friction: f_s <= μ_s * N (static), f_k = μ_k * N (kinetic).`,
            },
            {
              id: 'unit-phys-2',
              name: 'Unit 2: Work, Energy & Momentum',
              notes: `Conservation Principles:
- Work W = ∫ F · dr = ΔK (Work-Energy Theorem).
- Potential energy: F = -∇U. Conservative forces conserve total mechanical energy E = K + U.
- Linear momentum p = m*v is conserved in closed systems with no external net force.
- Elastic collisions: Both kinetic energy and momentum are conserved!`,
            },
            {
              id: 'unit-phys-3',
              name: 'Unit 3: Rotational Dynamics',
              notes: `Torque and Angular Momentum:
- Torque τ = r × F = I * α.
- Moment of inertia I = ∑ m_i * r_i² (rotational analogue of mass).
- Angular momentum L = r × p = I * ω. Conserved when net external torque is zero.`,
            },
            {
              id: 'unit-phys-4',
              name: 'Unit 4: Simple Harmonic Motion',
              notes: `Oscillations:
- Equation: d²x/dt² + ω² x = 0.
- Spring-mass: ω = √(k/m), Period T = 2π √(m/k).
- Simple pendulum: ω = √(g/L), Period T = 2π √(L/g) for small angle approximation sin(θ) ≈ θ.
- Damped oscillations: Underdamped, critically damped, overdamped.`,
            },
            {
              id: 'unit-phys-5',
              name: 'Unit 5: Mechanical Waves & Sound',
              notes: `Wave Mechanics:
- Wave equation: ∂²y/∂x² = (1/v²) ∂²y/∂t².
- Speed on a string: v = √(T_tension / μ_linear_density).
- Standing waves on string with fixed ends: λ_n = 2L / n.
- Doppler effect for sound: f' = f * (v_sound ± v_observer) / (v_sound ∓ v_source).`,
            },
          ],
        },
        {
          id: 'class-4',
          name: 'Class 4 - ENG 101: Academic Writing',
          code: 'ENG 101',
          instructor: 'Prof. Maya Angelou',
          color: '#7b4fd1',
          folderId: 'folder-fall-26',
          units: [
            {
              id: 'unit-eng-1',
              name: 'Unit 1: Rhetorical Analysis',
              notes: `Rhetorical Appeals:
- Ethos: Credibility and authority of the writer/speaker.
- Pathos: Emotional resonance and audience connection.
- Logos: Logical reasoning, statistical data, and empirical evidence.
- Kairos: Timeliness and opportunistic framing of the discourse.`,
            },
            {
              id: 'unit-eng-2',
              name: 'Unit 2: Scholarly Synthesis',
              notes: `Literature Review & Argumentation:
- Difference between summarizing single sources and synthesizing conversational themes across multiple researchers.
- Using counterarguments to strengthen core claims.`,
            },
          ],
        },
        {
          id: 'class-5',
          name: 'Class 5 - BIO 110: Molecular Biology',
          code: 'BIO 110',
          instructor: 'Dr. Rosalind Franklin',
          color: '#0f8a85',
          folderId: 'folder-fall-26',
          units: [
            {
              id: 'unit-bio-1',
              name: 'Unit 1: Cellular Respiration',
              notes: `Metabolic Pathways:
1. Glycolysis (Cytoplasm): Glucose -> 2 Pyruvate + 2 ATP + 2 NADH (anaerobic).
2. Pyruvate Oxidation: Pyruvate -> Acetyl-CoA + CO₂ + NADH.
3. Krebs Cycle (Mitochondrial Matrix): Generates NADH, FADH₂, ATP, releases CO₂.
4. Electron Transport Chain & Chemiosmosis: Proton gradient across inner membrane drives ATP Synthase (~30-32 ATP per glucose).`,
            },
            {
              id: 'unit-bio-2',
              name: 'Unit 2: DNA Replication & Transcription',
              notes: `Central Dogma of Biology:
- DNA -> RNA -> Protein.
- Helicase unzips double helix; DNA Polymerase III synthesizes 5' to 3'.
- Okazaki fragments on lagging strand joined by DNA Ligase.
- RNA Polymerase binds promoter region to transcribe mRNA.`,
            },
          ],
        },
      ],
    },
    {
      id: 'folder-spring-26',
      name: 'Spring Sem 26',
      classes: [
        {
          id: 'class-sp-1',
          name: 'Class 1 - CS 210: Computer Systems & Architecture',
          code: 'CS 210',
          instructor: 'Prof. John von Neumann',
          color: '#1f5c4d',
          folderId: 'folder-spring-26',
          units: [
            {
              id: 'unit-cs210-1',
              name: 'Unit 1: Bitwise Logic & Assembly (x86)',
              notes: 'Registers, instruction cycles, memory addressing modes, and stack alignment.',
            },
          ],
        },
        {
          id: 'class-sp-2',
          name: 'Class 2 - MATH 250: Linear Algebra',
          code: 'MATH 250',
          instructor: 'Dr. Gilbert Strang',
          color: '#2c6bd6',
          folderId: 'folder-spring-26',
          units: [
            {
              id: 'unit-math250-1',
              name: 'Unit 1: Matrix Inversion & Vector Spaces',
              notes: 'Span, linear independence, basis, dimension, null space, and column space.',
            },
          ],
        },
      ],
    },
    {
      id: 'folder-fall-25',
      name: 'Fall Sem 25',
      classes: [
        {
          id: 'class-fa25-1',
          name: 'Class 1 - CS 101: Principles of Programming',
          code: 'CS 101',
          instructor: 'Prof. Alan Turing',
          color: '#1f5c4d',
          folderId: 'folder-fall-25',
          units: [
            {
              id: 'unit-cs101-1',
              name: 'Unit 1: Variables, Loops & Functions',
              notes: 'Introductory control structures and algorithmic decomposition.',
            },
          ],
        },
      ],
    },
  ];
}
