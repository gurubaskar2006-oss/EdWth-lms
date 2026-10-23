/**
 * Lumina LMS — Real Academic Python Curriculum for School Students
 * Units 1 through 13 with structured lessons, examples, explanations, and practice.
 */

export const PYTHON_SCHOOL_CURRICULUM = [
  {
    unitNumber: 1,
    title: "Python Basics",
    description: "Introduction to computer programming, Python syntax, and basic commands.",
    topics: [
      {
        topicNumber: 1,
        title: "What is Python?",
        description: "Understanding Python as an interpreted, beginner-friendly programming language.",
        lessons: [
          {
            title: "Introduction to Python",
            whatIsIt: "Python is a popular, beginner-friendly programming language created by Guido van Rossum in 1991. It reads almost like plain English.",
            whyUseIt: "It is easy to learn, used everywhere from school robotics to web development and artificial intelligence, and runs on Windows, Mac, and Linux.",
            syntax: "# Python code is executed line by line from top to bottom.",
            example: "print(\"Welcome to Python Programming!\")",
            explanation: [
              "print() is a built-in function that displays text or numbers on your screen.",
              "The quotation marks \"...\" tell Python that the text inside is a string of characters."
            ],
            expectedOutput: "Welcome to Python Programming!",
            commonMistakes: [
              "Forgetting closing quotation marks or parentheses: print(\"Hello)",
              "Capitalizing Print() — Python is case-sensitive and will show a NameError."
            ],
            tryItYourself: "Write a command that displays your school name.",
            starterCode: "print(\"Oakridge High School\")\n",
            practiceQuestion: "What happens if you type print(5 + 3) without quotes? Try it!"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "Python Syntax",
        description: "Basic rules of writing Python code, indentation, and clean structure.",
        lessons: [
          {
            title: "Rules of Python Syntax",
            whatIsIt: "Syntax is the set of rules that defines how Python programs are written and interpreted.",
            whyUseIt: "Computers follow exact instructions. Clean syntax avoids SyntaxError messages.",
            syntax: "command_one()\ncommand_two()",
            example: "print(\"Line 1\")\nprint(\"Line 2\")",
            explanation: [
              "Each command is written on its own line.",
              "Python does not require semicolons at the end of lines like C++ or Java."
            ],
            expectedOutput: "Line 1\nLine 2",
            commonMistakes: [
              "Adding accidental spaces or tabs at the start of a regular line causing IndentationError."
            ],
            tryItYourself: "Print three lines introducing yourself (name, grade, favorite subject).",
            starterCode: "print(\"My name is Leo\")\nprint(\"Grade 10\")\nprint(\"Computer Science\")\n",
            practiceQuestion: "Why does Python give an IndentationError when a space is added at the start of a line?"
          }
        ]
      },
      {
        topicNumber: 3,
        title: "print() Function",
        description: "Displaying text, numbers, and multiple items on the screen.",
        lessons: [
          {
            title: "Mastering print()",
            whatIsIt: "The print() function outputs whatever you place inside its parentheses to the console.",
            whyUseIt: "It is how your program communicates with the user and displays calculation results.",
            syntax: "print(item1, item2, sep=\" \")",
            example: "print(\"Score:\", 95, \"Points\")",
            explanation: [
              "Multiple items separated by commas are printed with a space between them by default.",
              "Numbers do not need quotation marks."
            ],
            expectedOutput: "Score: 95 Points",
            commonMistakes: [
              "Putting quotes around arithmetic expressions when you want the calculation: print(\"10 + 5\") outputs '10 + 5' instead of 15."
            ],
            tryItYourself: "Print the total cost of 3 books that cost 12 dollars each: print(3 * 12).",
            starterCode: "print(\"Total price:\", 3 * 12)\n",
            practiceQuestion: "Print your first and last name separated by a comma using print()."
          }
        ]
      },
      {
        topicNumber: 4,
        title: "Comments",
        description: "Writing developer notes that Python ignores during execution.",
        lessons: [
          {
            title: "Code Comments with #",
            whatIsIt: "A comment is a human-readable note in code that the Python interpreter completely ignores.",
            whyUseIt: "Comments help you and your classmates understand what a complex line of code does.",
            syntax: "# This is a single-line comment",
            example: "# Calculate the area of a rectangle\nprint(5 * 8)  # 40 square units",
            explanation: [
              "Any text following the hash symbol (#) on that line is ignored by Python.",
              "Useful for temporarily disabling a line of code during testing."
            ],
            expectedOutput: "40",
            commonMistakes: [
              "Using // instead of # (// is integer division in Python, not a comment!)."
            ],
            tryItYourself: "Add a comment explaining what your favorite program will do.",
            starterCode: "# Program to calculate circle area\nprint(3.14 * 5 * 5)\n",
            practiceQuestion: "What character starts a single-line comment in Python?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 2,
    title: "Variables & Data Types",
    description: "Storing information in memory and understanding fundamental data formats.",
    topics: [
      {
        topicNumber: 1,
        title: "Variables",
        description: "Named storage containers that hold values in memory.",
        lessons: [
          {
            title: "Creating & Assigning Variables",
            whatIsIt: "A variable is like a labeled storage box that holds a piece of data in computer memory.",
            whyUseIt: "Instead of repeating values, we give them a name so we can reuse and update them easily.",
            syntax: "variable_name = value",
            example: "student_name = \"Leo\"\nage = 15\nprint(student_name, \"is\", age, \"years old.\")",
            explanation: [
              "The equal sign (=) is the assignment operator. It stores the value on the right into the name on the left.",
              "Variable names cannot start with a number or contain spaces."
            ],
            expectedOutput: "Leo is 15 years old.",
            commonMistakes: [
              "Writing age + 1 without saving it back: age = age + 1.",
              "Using a reserved keyword like class or if as a variable name."
            ],
            tryItYourself: "Create a variable called school and assign your school name, then print it.",
            starterCode: "school = \"Oakridge High School\"\nprint(\"I study at\", school)\n",
            practiceQuestion: "Can a Python variable name start with a number (e.g. 1st_place)? Why not?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "Integers & Floats",
        description: "Working with whole numbers and decimal numbers in calculations.",
        lessons: [
          {
            title: "Numeric Data Types",
            whatIsIt: "Integers (int) are whole numbers like 10, -5, 0. Floats (float) are numbers with decimal points like 3.14, -0.5.",
            whyUseIt: "Used for scores, counters, financial calculations, and scientific measurements.",
            syntax: "my_int = 10\nmy_float = 10.5",
            example: "items = 4\nprice_per_item = 2.50\ntotal = items * price_per_item\nprint(\"Total cost:\", total)",
            explanation: [
              "Multiplying an int with a float produces a float result.",
              "Division (/) in Python always produces a float result."
            ],
            expectedOutput: "Total cost: 10.0",
            commonMistakes: [
              "Putting commas inside large numbers like 1,000 (Python sees this as a tuple of numbers: 1 and 000!)."
            ],
            tryItYourself: "Calculate the average of test scores 85, 90, and 95.",
            starterCode: "average = (85 + 90 + 95) / 3\nprint(\"Average:\", average)\n",
            practiceQuestion: "What is the data type of the result when you run 10 / 2 in Python?"
          }
        ]
      },
      {
        topicNumber: 3,
        title: "Strings",
        description: "Text sequences enclosed in single or double quotation marks.",
        lessons: [
          {
            title: "Working with Text Strings",
            whatIsIt: "A string (str) is a sequence of characters surrounded by matching single quotes ('...') or double quotes (\"...\").",
            whyUseIt: "Used to store student names, messages, addresses, and any textual data.",
            syntax: "text = \"Hello World\"",
            example: "greeting = \"Hello\"\nname = \"Samantha\"\nfull_message = greeting + \", \" + name + \"!\"\nprint(full_message)",
            explanation: [
              "The + operator combines (concatenates) two strings together into one.",
              "Strings are immutable — once created, their individual characters cannot be changed in-place."
            ],
            expectedOutput: "Hello, Samantha!",
            commonMistakes: [
              "Trying to concatenate a string and a number directly: \"Age: \" + 15 produces a TypeError. Use str(15) or commas."
            ],
            tryItYourself: "Concatenate your first and last name variables with a space between them.",
            starterCode: "first = \"Leo\"\nlast = \"Miller\"\nprint(first + \" \" + last)\n",
            practiceQuestion: "How do you find the total number of characters in a string?"
          }
        ]
      },
      {
        topicNumber: 4,
        title: "Booleans",
        description: "True and False values for decision making and conditional checks.",
        lessons: [
          {
            title: "Boolean Truth Values",
            whatIsIt: "A boolean (bool) represents one of two possible states: True or False.",
            whyUseIt: "Computers use booleans to make decisions like whether a student passed or if a door is locked.",
            syntax: "is_passed = True\nis_absent = False",
            example: "score = 85\npassed = score >= 60\nprint(\"Did student pass?\", passed)",
            explanation: [
              "Notice True and False are capitalized in Python.",
              "Comparison expressions like score >= 60 evaluate to a boolean."
            ],
            expectedOutput: "Did student pass? True",
            commonMistakes: [
              "Writing lowercase true or false which Python treats as undefined variable names."
            ],
            tryItYourself: "Check if 10 is equal to 20 using the == operator.",
            starterCode: "is_equal = (10 == 20)\nprint(is_equal)\n",
            practiceQuestion: "What will 15 > 10 evaluate to?"
          }
        ]
      },
      {
        topicNumber: 5,
        title: "Type Conversion",
        description: "Converting values between int, float, str, and bool.",
        lessons: [
          {
            title: "Casting Between Types",
            whatIsIt: "Type conversion (or casting) transforms a value from one data type to another using int(), float(), or str().",
            whyUseIt: "User input from keyboards always comes in as a string, so we must convert it to an integer to do math.",
            syntax: "converted = int(\"25\")",
            example: "text_num = \"42\"\nreal_num = int(text_num)\nprint(real_num + 8)",
            explanation: [
              "int(\"42\") converts the string \"42\" into the numeric integer 42.",
              "str(100) converts the integer 100 into the string \"100\"."
            ],
            expectedOutput: "50",
            commonMistakes: [
              "Trying to convert a non-numeric string like int(\"hello\") which causes a ValueError."
            ],
            tryItYourself: "Convert \"19.99\" to a float and add 5.0 to it.",
            starterCode: "price = float(\"19.99\")\nprint(price + 5.0)\n",
            practiceQuestion: "What happens if you run int(\"3.14\") directly?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 3,
    title: "Operators",
    description: "Performing arithmetic, comparisons, logical operations, and operator precedence.",
    topics: [
      {
        topicNumber: 1,
        title: "Arithmetic Operators",
        description: "Addition (+), subtraction (-), multiplication (*), division (/), floor division (//), modulus (%), and exponentiation (**).",
        lessons: [
          {
            title: "Math in Python",
            whatIsIt: "Arithmetic operators perform mathematical calculations on numeric operands.",
            whyUseIt: "Essential for financial apps, science simulations, games, and scoring algorithms.",
            syntax: "res = a + b  # also -, *, /, //, %, **",
            example: "print(\"10 // 3 =\", 10 // 3)  # Floor division\nprint(\"10 % 3 =\", 10 % 3)    # Modulus (remainder)\nprint(\"2 ** 3 =\", 2 ** 3)    # 2 to the power of 3",
            explanation: [
              "// gives the whole number quotient without the decimal remainder.",
              "% gives the remainder after division (useful for checking even/odd numbers).",
              "** raises a base to an exponent."
            ],
            expectedOutput: "10 // 3 = 3\n10 % 3 = 1\n2 ** 3 = 8",
            commonMistakes: [
              "Dividing by zero (e.g. 5 / 0) which causes a ZeroDivisionError."
            ],
            tryItYourself: "Use the modulus operator % to check the remainder of 17 divided by 4.",
            starterCode: "remainder = 17 % 4\nprint(\"Remainder:\", remainder)\n",
            practiceQuestion: "How do you check if an integer n is even in Python?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "Comparison Operators",
        description: "Comparing two values: ==, !=, <, <=, >, >=.",
        lessons: [
          {
            title: "Comparing Values",
            whatIsIt: "Comparison operators test relationships between two values and always return True or False.",
            whyUseIt: "Used in if statements to check if conditions are met before taking action.",
            syntax: "a == b, a != b, a > b, a < b, a >= b, a <= b",
            example: "a = 10\nb = 20\nprint(\"Is a == b?\", a == b)\nprint(\"Is a < b?\", a < b)",
            explanation: [
              "== tests equality (are both values equal?).",
              "!= tests inequality (are they different?).",
              "Do not confuse = (store value) with == (compare values)!"
            ],
            expectedOutput: "Is a == b? False\nIs a < b? True",
            commonMistakes: [
              "Using a single = inside a comparison like if x = 5 (SyntaxError)."
            ],
            tryItYourself: "Check if 50 is greater than or equal to 50.",
            starterCode: "print(50 >= 50)\n",
            practiceQuestion: "What is the difference between = and ==?"
          }
        ]
      },
      {
        topicNumber: 3,
        title: "Logical Operators",
        description: "Combining multiple conditions with and, or, not.",
        lessons: [
          {
            title: "and, or, not Operators",
            whatIsIt: "Logical operators combine multiple boolean expressions into a single boolean decision.",
            whyUseIt: "Often you need more than one condition to be met, e.g. age >= 18 AND has_license.",
            syntax: "cond1 and cond2\ncond1 or cond2\nnot cond",
            example: "score = 88\nattendance = 92\nis_eligible = (score >= 80) and (attendance >= 90)\nprint(\"Honor Roll Eligible:\", is_eligible)",
            explanation: [
              "and returns True only if BOTH conditions are True.",
              "or returns True if AT LEAST ONE condition is True.",
              "not flips the boolean: not True is False."
            ],
            expectedOutput: "Honor Roll Eligible: True",
            commonMistakes: [
              "Writing if 80 <= score and attendance >= 90 without clear parentheses can lead to confusion."
            ],
            tryItYourself: "Write an expression that checks if a number is between 10 and 50.",
            starterCode: "n = 25\nprint(n >= 10 and n <= 50)\n",
            practiceQuestion: "If a = True and b = False, what is (a or b)?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 4,
    title: "Input & Output",
    description: "Accepting interactive user input and formatting clean screen outputs.",
    topics: [
      {
        topicNumber: 1,
        title: "input() Function",
        description: "Reading text typed by the user from the keyboard.",
        lessons: [
          {
            title: "Interactive User Input",
            whatIsIt: "The input() function pauses execution and waits for the user to type something and press Enter.",
            whyUseIt: "Programs become interactive when they can respond to what a student enters.",
            syntax: "user_text = input(\"Prompt message: \")",
            example: "# Simulated input demonstration\nuser_name = \"Leo\"\nprint(\"Hello,\", user_name + \"!\")",
            explanation: [
              "input() ALWAYS returns whatever was typed as a string (str).",
              "If you want to do math with user input, wrap it with int() or float()."
            ],
            expectedOutput: "Hello, Leo!",
            commonMistakes: [
              "Forgetting to convert input: age = input(\"Age: \"); next_age = age + 1 causes TypeError."
            ],
            tryItYourself: "Demonstrate converting a simulated input string \"16\" to an int and adding 1.",
            starterCode: "age_str = \"16\"\nage = int(age_str)\nprint(\"Next year you will be:\", age + 1)\n",
            practiceQuestion: "What data type does input() always return?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "Formatted Strings (f-strings)",
        description: "Embedding variables and expressions cleanly inside strings.",
        lessons: [
          {
            title: "f-Strings in Python 3",
            whatIsIt: "An f-string is created by prefixing a string with 'f' and placing variables or expressions inside curly braces {}.",
            whyUseIt: "It is much cleaner and faster than concatenating with plus signs (+).",
            syntax: "f\"Hello {variable_name}\"",
            example: "student = \"Maya\"\nsubject = \"Python\"\ngrade = 98\nprint(f\"{student} scored {grade}% in {subject}!\")",
            explanation: [
              "Python automatically replaces {student} with Maya and {grade} with 98.",
              "You can even put math inside the curly braces: f\"{5 * 10}\"."
            ],
            expectedOutput: "Maya scored 98% in Python!",
            commonMistakes: [
              "Forgetting the leading 'f' before the quotes: \"Hello {name}\" will print literal {name}."
            ],
            tryItYourself: "Use an f-string to print: \"The product of 7 and 8 is {7 * 8}\".",
            starterCode: "print(f\"The product of 7 and 8 is {7 * 8}\")\n",
            practiceQuestion: "What prefix is placed before quotation marks to create an f-string?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 5,
    title: "Conditional Statements",
    description: "Making decisions with if, if/else, if/elif/else, and nested conditions.",
    topics: [
      {
        topicNumber: 1,
        title: "if Statement",
        description: "Executing a block of code only when a condition is True.",
        lessons: [
          {
            title: "Basic if Condition",
            whatIsIt: "The if statement checks a condition. If the condition is True, its indented code block runs.",
            whyUseIt: "It lets computers take different paths based on data.",
            syntax: "if condition:\n    # indented code block",
            example: "score = 85\nif score >= 50:\n    print(\"Status: Passed\")",
            explanation: [
              "The colon (:) at the end of the if line is required.",
              "The code indented by 4 spaces underneath is called the body of the if statement."
            ],
            expectedOutput: "Status: Passed",
            commonMistakes: [
              "Forgetting the colon (:) at the end of the if statement line."
            ],
            tryItYourself: "Write an if statement that prints \"Adult\" if age is 18 or older.",
            starterCode: "age = 20\nif age >= 18:\n    print(\"Adult\")\n",
            practiceQuestion: "What symbol must be placed at the end of an if statement header?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "if / else Statement",
        description: "Providing an alternative action when the condition is False.",
        lessons: [
          {
            title: "Two-Way Decisions with else",
            whatIsIt: "The else block runs whenever the preceding if condition evaluates to False.",
            whyUseIt: "Guarantees that one of two actions will always be executed.",
            syntax: "if condition:\n    # action 1\nelse:\n    # action 2",
            example: "temperature = 15\nif temperature > 22:\n    print(\"Wear t-shirt\")\nelse:\n    print(\"Wear jacket\")",
            explanation: [
              "The else keyword has no condition attached to it.",
              "Either the if branch OR the else branch runs, never both."
            ],
            expectedOutput: "Wear jacket",
            commonMistakes: [
              "Putting a condition after else like else x < 10 (use elif for additional conditions!)."
            ],
            tryItYourself: "Check if a number is positive or negative using if and else.",
            starterCode: "num = -5\nif num >= 0:\n    print(\"Positive\")\nelse:\n    print(\"Negative\")\n",
            practiceQuestion: "When does the code inside an else block execute?"
          }
        ]
      },
      {
        topicNumber: 3,
        title: "if / elif / else Ladder",
        description: "Checking multiple mutually exclusive conditions in sequence.",
        lessons: [
          {
            title: "Multi-Way Decisions with elif",
            whatIsIt: "elif stands for 'else if'. It lets you test several alternative conditions one after another.",
            whyUseIt: "Used for letter grades (A, B, C, D, F) or traffic lights.",
            syntax: "if cond1:\n    # A\nelif cond2:\n    # B\nelse:\n    # C",
            example: "score = 82\nif score >= 90:\n    grade = \"A\"\nelif score >= 80:\n    grade = \"B\"\nelif score >= 70:\n    grade = \"C\"\nelse:\n    grade = \"Needs Improvement\"\nprint(f\"Letter Grade: {grade}\")",
            explanation: [
              "Python checks conditions from top to bottom.",
              "As soon as one condition is True, its block runs and Python skips the rest of the ladder."
            ],
            expectedOutput: "Letter Grade: B",
            commonMistakes: [
              "Putting broad conditions first, which blocks narrower ones from ever running."
            ],
            tryItYourself: "Write an elif ladder to classify water state: <= 0 is Ice, < 100 is Liquid, >= 100 is Steam.",
            starterCode: "temp = 25\nif temp <= 0:\n    print(\"Ice\")\nelif temp < 100:\n    print(\"Liquid\")\nelse:\n    print(\"Steam\")\n",
            practiceQuestion: "What does the keyword elif stand for in Python?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 6,
    title: "Loops",
    description: "Repeating code efficiently using for loops, while loops, range(), break, and continue.",
    topics: [
      {
        topicNumber: 1,
        title: "for Loops & range()",
        description: "Iterating a specific number of times or through a sequence.",
        lessons: [
          {
            title: "Counted Iteration with for & range",
            whatIsIt: "A for loop repeats a block of code for each item in a sequence or range of numbers.",
            whyUseIt: "Instead of writing 100 print statements, a loop does it in 2 lines.",
            syntax: "for i in range(start, stop, step):\n    # repeat",
            example: "for count in range(1, 5):\n    print(f\"Count: {count}\")",
            explanation: [
              "range(1, 5) generates numbers 1, 2, 3, 4 (it stops BEFORE the end number 5).",
              "Each time through the loop, the variable count takes the next number."
            ],
            expectedOutput: "Count: 1\nCount: 2\nCount: 3\nCount: 4",
            commonMistakes: [
              "Expecting range(1, 5) to include 5. In Python, range stops at stop - 1."
            ],
            tryItYourself: "Write a for loop that prints even numbers from 2 to 10 using range(2, 11, 2).",
            starterCode: "for n in range(2, 11, 2):\n    print(n)\n",
            practiceQuestion: "How many times will for i in range(5): run?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "while Loops",
        description: "Repeating code as long as a boolean condition remains True.",
        lessons: [
          {
            title: "Conditional Iteration with while",
            whatIsIt: "A while loop continues running over and over until its condition becomes False.",
            whyUseIt: "Used when you do not know ahead of time how many repetitions are needed (e.g. waiting for correct password).",
            syntax: "while condition:\n    # repeat\n    # update condition",
            example: "countdown = 3\nwhile countdown > 0:\n    print(f\"{countdown}...\")\n    countdown -= 1\nprint(\"Liftoff!\")",
            explanation: [
              "countdown -= 1 decreases the counter by 1 each round.",
              "If you forget to update the counter, the condition never becomes False, creating an infinite loop!"
            ],
            expectedOutput: "3...\n2...\n1...\nLiftoff!",
            commonMistakes: [
              "Creating an infinite loop by forgetting to change the loop variable inside the body."
            ],
            tryItYourself: "Write a while loop that starts at 1 and doubles the number until it exceeds 20.",
            starterCode: "x = 1\nwhile x <= 20:\n    print(x)\n    x *= 2\n",
            practiceQuestion: "What causes an infinite loop in a program?"
          }
        ]
      },
      {
        topicNumber: 3,
        title: "break & continue",
        description: "Controlling loop execution flow by exiting early or skipping iterations.",
        lessons: [
          {
            title: "Loop Control Flow",
            whatIsIt: "break stops and exits the loop immediately. continue skips the rest of the current iteration and jumps to the next.",
            whyUseIt: "Useful when you find the target item in a search and want to stop immediately.",
            syntax: "if target_found: break\nif skip_condition: continue",
            example: "for n in range(1, 6):\n    if n == 3:\n        continue  # Skip 3\n    if n == 5:\n        break     # Stop at 5\n    print(n)",
            explanation: [
              "When n == 3, continue skips the print and moves directly to n == 4.",
              "When n == 5, break terminates the loop completely."
            ],
            expectedOutput: "1\n2\n4",
            commonMistakes: [
              "Placing code after break inside the same block (it will never execute)."
            ],
            tryItYourself: "Print numbers 1 to 10, but break as soon as the number reaches 7.",
            starterCode: "for i in range(1, 11):\n    if i == 7: break\n    print(i)\n",
            practiceQuestion: "What is the difference between break and continue?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 7,
    title: "Functions",
    description: "Creating reusable modular code with def, parameters, arguments, and return values.",
    topics: [
      {
        topicNumber: 1,
        title: "What is a Function?",
        description: "Understanding functions as reusable named blocks of code.",
        lessons: [
          {
            title: "Defining & Calling Functions",
            whatIsIt: "A function is a reusable block of code that performs a specific task when called.",
            whyUseIt: "Avoids repeating code (DRY - Don't Repeat Yourself) and makes programs organized and easy to test.",
            syntax: "def function_name():\n    # body\nfunction_name()",
            example: "def say_hello():\n    print(\"Hello, student!\")\n\nsay_hello()\nsay_hello()",
            explanation: [
              "def creates a function definition.",
              "say_hello is the function name.",
              "() can hold parameters.",
              ": starts the indented function body.",
              "say_hello() calls (executes) the function."
            ],
            expectedOutput: "Hello, student!\nHello, student!",
            commonMistakes: [
              "Defining a function but forgetting to call it with parentheses say_hello()."
            ],
            tryItYourself: "Define a function cheer() that prints \"Go Oakridge Lions!\" and call it.",
            starterCode: "def cheer():\n    print(\"Go Oakridge Lions!\")\n\ncheer()\n",
            practiceQuestion: "Which Python keyword is used to define a function?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "Parameters & Arguments",
        description: "Passing data into functions so they can work with different inputs.",
        lessons: [
          {
            title: "Customizing Function Behavior",
            whatIsIt: "A parameter is a variable listed inside the parentheses in the function definition. An argument is the actual value sent when calling it.",
            whyUseIt: "Enables a single function to greet any person, calculate tax for any amount, or draw any shape.",
            syntax: "def greet(name):\n    print(f\"Hello, {name}!\")\ngreet(\"Leo\")",
            example: "def greet_student(name, grade):\n    print(f\"{name} is in Grade {grade}.\")\n\ngreet_student(\"Leo\", 10)\ngreet_student(\"Maya\", 10)",
            explanation: [
              "name and grade are parameters.",
              "\"Leo\" and 10 are arguments.",
              "Multiple parameters are separated by commas."
            ],
            expectedOutput: "Leo is in Grade 10.\nMaya is in Grade 10.",
            commonMistakes: [
              "Calling the function with too few or too many arguments: greet_student(\"Leo\") causes TypeError."
            ],
            tryItYourself: "Write a function print_double(n) that prints n * 2.",
            starterCode: "def print_double(n):\n    print(n * 2)\n\nprint_double(7)\n",
            practiceQuestion: "What is the difference between a parameter and an argument?"
          }
        ]
      },
      {
        topicNumber: 3,
        title: "Return Values",
        description: "Sending calculation results back from a function to the caller.",
        lessons: [
          {
            title: "The return Keyword",
            whatIsIt: "The return statement ends function execution and sends a value back to the line that called it.",
            whyUseIt: "Lets functions calculate results that can be stored in variables and used in further math.",
            syntax: "def add(a, b):\n    return a + b\nres = add(5, 3)",
            example: "def calculate_area(length, width):\n    return length * width\n\nroom_area = calculate_area(12, 10)\nprint(f\"Total Room Area: {room_area} sq ft\")",
            explanation: [
              "return sends the result back to the caller.",
              "Any code written after a return statement in the same block will never run.",
              "If a function has no return, it returns None by default."
            ],
            expectedOutput: "Total Room Area: 120 sq ft",
            commonMistakes: [
              "Confusing print() with return. print() only shows text on screen; return hands data to your code."
            ],
            tryItYourself: "Write a function square(x) that returns x * x.",
            starterCode: "def square(x):\n    return x * x\n\nresult = square(9)\nprint(\"Square of 9 is:\", result)\n",
            practiceQuestion: "What value does a Python function return if it has no return statement?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 8,
    title: "Strings",
    description: "String indexing, slicing, common methods, and string manipulation techniques.",
    topics: [
      {
        topicNumber: 1,
        title: "Indexing & Slicing",
        description: "Accessing individual characters and substrings by position.",
        lessons: [
          {
            title: "String Indices & Slices",
            whatIsIt: "Strings are indexed starting from 0. Negative indices count backward from the end (-1 is the last character).",
            whyUseIt: "Extract initials, phone prefixes, or reverse words.",
            syntax: "s[index]  # single character\ns[start:stop:step]  # substring",
            example: "word = \"PYTHON\"\nprint(\"First char:\", word[0])\nprint(\"Last char:\", word[-1])\nprint(\"Slice [0:2]:\", word[0:2])\nprint(\"Reversed:\", word[::-1])",
            explanation: [
              "word[0] gives 'P'.",
              "word[-1] gives 'N'.",
              "word[0:2] slices up to index 2 (not including 2), giving 'PY'.",
              "word[::-1] with step -1 reverses the entire string!"
            ],
            expectedOutput: "First char: P\nLast char: N\nSlice [0:2]: PY\nReversed: NOHTYP",
            commonMistakes: [
              "IndexError: string index out of range when accessing index >= len(string)."
            ],
            tryItYourself: "Reverse the string \"level\" using slice syntax [::-1].",
            starterCode: "text = \"level\"\nprint(text == text[::-1])\n",
            practiceQuestion: "What is the index of the first character in any Python string?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "String Methods",
        description: "Built-in methods like .upper(), .lower(), .strip(), .replace(), and .split().",
        lessons: [
          {
            title: "Common String Methods",
            whatIsIt: "Methods are built-in functions attached to strings that transform or inspect text.",
            whyUseIt: "Clean user input (remove spaces, normalize lowercase) before validating.",
            syntax: "s.lower(), s.upper(), s.strip(), s.replace(old, new)",
            example: "raw = \"   Oakridge High School   \"\nclean = raw.strip().upper()\nprint(clean)\nreplaced = clean.replace(\"HIGH\", \"SECONDARY\")\nprint(replaced)",
            explanation: [
              ".strip() removes leading and trailing spaces.",
              ".upper() converts all letters to uppercase.",
              ".replace(old, new) swaps target occurrences."
            ],
            expectedOutput: "OAKRIDGE HIGH SCHOOL\nOAKRIDGE SECONDARY SCHOOL",
            commonMistakes: [
              "Thinking s.upper() modifies s in-place. Strings are immutable, so assign the result: s = s.upper()."
            ],
            tryItYourself: "Convert \"python is fun\" to title case with .title().",
            starterCode: "msg = \"python is fun\"\nprint(msg.title())\n",
            practiceQuestion: "Do string methods modify the original string or return a new one?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 9,
    title: "Lists",
    description: "Ordered, mutable collections of items, list indexing, and essential list methods.",
    topics: [
      {
        topicNumber: 1,
        title: "Creating & Accessing Lists",
        description: "Storing multiple items in square brackets [].",
        lessons: [
          {
            title: "Working with Lists",
            whatIsIt: "A list is an ordered collection of items surrounded by square brackets []. Lists are mutable (can be changed).",
            whyUseIt: "Keep track of student scores, shopping lists, or inventory items.",
            syntax: "items = [item1, item2, item3]",
            example: "fruits = [\"apple\", \"banana\", \"cherry\"]\nprint(\"First fruit:\", fruits[0])\nfruits[1] = \"blueberry\"  # Mutate\nprint(\"Updated list:\", fruits)",
            explanation: [
              "Lists can contain integers, floats, strings, or mixed types.",
              "You can update any element by assigning to its index: fruits[1] = ...",
              "len(fruits) gives the total number of items."
            ],
            expectedOutput: "First fruit: apple\nUpdated list: ['apple', 'blueberry', 'cherry']",
            commonMistakes: [
              "Using parentheses () instead of square brackets [] (that creates a tuple, not a list!)."
            ],
            tryItYourself: "Create a list of your top 3 favorite subjects and print the first one.",
            starterCode: "subjects = [\"Computer Science\", \"Math\", \"Physics\"]\nprint(\"Favorite:\", subjects[0])\n",
            practiceQuestion: "What bracket type is used to define a list in Python?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "List Methods",
        description: "Adding, removing, and sorting elements: .append(), .pop(), .insert(), .sort().",
        lessons: [
          {
            title: "Modifying Lists with Methods",
            whatIsIt: "Methods let you grow, shrink, and rearrange lists dynamically during program execution.",
            whyUseIt: "Add new student enrollments, remove departed students, and rank test scores.",
            syntax: "lst.append(x), lst.pop(), lst.insert(i, x), lst.sort()",
            example: "scores = [88, 75, 92]\nscores.append(99)   # Add to end\nscores.sort()       # Sort ascending\nprint(\"Sorted scores:\", scores)\nlast = scores.pop() # Remove and return last\nprint(\"Highest removed:\", last)",
            explanation: [
              ".append(val) adds val to the very end of the list.",
              ".sort() sorts numbers from smallest to largest in-place.",
              ".pop() removes and returns the last item."
            ],
            expectedOutput: "Sorted scores: [75, 88, 92, 99]\nHighest removed: 99",
            commonMistakes: [
              "Calling scores = scores.append(100). append() returns None, so scores becomes None!"
            ],
            tryItYourself: "Create an empty list, append 3 numbers to it, and print len().",
            starterCode: "nums = []\nnums.append(10)\nnums.append(20)\nnums.append(30)\nprint(\"Count:\", len(nums))\n",
            practiceQuestion: "What does the list method .append() return?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 10,
    title: "Tuples",
    description: "Ordered, immutable sequences enclosed in parentheses ().",
    topics: [
      {
        topicNumber: 1,
        title: "Creating & Unpacking Tuples",
        description: "Understanding immutable tuples and when to choose them over lists.",
        lessons: [
          {
            title: "Tuples vs Lists",
            whatIsIt: "A tuple is an ordered collection surrounded by parentheses (). Unlike lists, tuples CANNOT be modified after creation (immutable).",
            whyUseIt: "Protect fixed data like coordinates (x, y) or RGB colors (255, 0, 0) from accidental changes.",
            syntax: "coordinates = (10, 20)\nx, y = coordinates  # Unpack",
            example: "point = (4, 7)\nprint(\"X:\", point[0], \"Y:\", point[1])\nx, y = point  # Tuple unpacking\nprint(f\"Unpacked: x={x}, y={y}\")",
            explanation: [
              "Once created, you cannot append, pop, or change items in a tuple.",
              "Tuple unpacking assigns each element to a corresponding variable in one step."
            ],
            expectedOutput: "X: 4 Y: 7\nUnpacked: x=4, y=7",
            commonMistakes: [
              "Trying to mutate a tuple: point[0] = 5 causes a TypeError: 'tuple' object does not support item assignment."
            ],
            tryItYourself: "Create a tuple representing screen dimensions (width, height) = (1920, 1080).",
            starterCode: "resolution = (1920, 1080)\nw, h = resolution\nprint(f\"Resolution: {w}x{h}\")\n",
            practiceQuestion: "Can you change an item inside a tuple after it is created?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 11,
    title: "Dictionaries",
    description: "Key-value pair data structures for fast lookups and organized records.",
    topics: [
      {
        topicNumber: 1,
        title: "Key-Value Pairs",
        description: "Storing structured data using curly braces {key: value}.",
        lessons: [
          {
            title: "Introduction to Dictionaries",
            whatIsIt: "A dictionary is a collection of key-value pairs enclosed in curly braces {}. Keys must be unique.",
            whyUseIt: "Model real-world entities like a student record, book catalog, or phonebook.",
            syntax: "student = {\"name\": \"Leo\", \"grade\": 10}",
            example: "student = {\n    \"name\": \"Leo Miller\",\n    \"grade\": 10,\n    \"gpa\": 3.9\n}\nprint(\"Student Name:\", student[\"name\"])\nstudent[\"gpa\"] = 4.0  # Update\nprint(\"Updated GPA:\", student[\"gpa\"])",
            explanation: [
              "\"name\" is the key; \"Leo Miller\" is the value.",
              "Lookups by key are nearly instantaneous even with millions of items."
            ],
            expectedOutput: "Student Name: Leo Miller\nUpdated GPA: 4.0",
            commonMistakes: [
              "KeyError when accessing a key that does not exist. Use student.get(\"key\", default) to be safe."
            ],
            tryItYourself: "Create a dictionary for a book with keys 'title', 'author', and 'year'.",
            starterCode: "book = {\"title\": \"Python for Beginners\", \"author\": \"Guido\", \"year\": 2026}\nprint(book[\"title\"])\n",
            practiceQuestion: "What happens if you look up a dictionary key that does not exist using square brackets?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "Dictionary Methods & Iteration",
        description: "Using .keys(), .values(), .items(), and looping over key-value pairs.",
        lessons: [
          {
            title: "Looping Through Dictionaries",
            whatIsIt: "Methods like .items() allow you to loop through keys and values simultaneously.",
            whyUseIt: "Display report cards, customer invoices, or settings menus.",
            syntax: "for key, val in my_dict.items():\n    # process",
            example: "grades = {\"Math\": 95, \"Physics\": 88, \"Python\": 98}\nfor subject, score in grades.items():\n    print(f\"{subject}: {score}%\")",
            explanation: [
              ".keys() gives all keys.",
              ".values() gives all values.",
              ".items() gives pairs of (key, value)."
            ],
            expectedOutput: "Math: 95%\nPhysics: 88%\nPython: 98%",
            commonMistakes: [
              "Writing for k, v in grades: without .items() (Python loops over only keys by default!)."
            ],
            tryItYourself: "Loop over inventory items and print each item and its count.",
            starterCode: "stock = {\"pens\": 12, \"notebooks\": 5, \"erasers\": 8}\nfor item, count in stock.items():\n    print(f\"{item}: {count}\")\n",
            practiceQuestion: "Which dictionary method returns pairs of (key, value) for looping?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 12,
    title: "Sets",
    description: "Unordered collections of unique elements, set operations, and removing duplicates.",
    topics: [
      {
        topicNumber: 1,
        title: "Unique Elements & Set Operations",
        description: "Set creation, union, intersection, difference, and deduplication.",
        lessons: [
          {
            title: "Working with Sets",
            whatIsIt: "A set is an unordered collection of unique elements enclosed in curly braces {}. Duplicates are discarded automatically.",
            whyUseIt: "Remove duplicate survey responses, find common interests between clubs, or check membership fast.",
            syntax: "my_set = {1, 2, 3}\nunion = set_a | set_b\ninter = set_a & set_b",
            example: "numbers = [1, 2, 2, 3, 4, 4, 5]\nunique_nums = set(numbers)\nprint(\"Unique elements:\", unique_nums)\n\nclub_a = {\"Leo\", \"Maya\", \"Daniel\"}\nclub_b = {\"Maya\", \"Aisha\"}\nprint(\"In both clubs:\", club_a & club_b)  # Intersection",
            explanation: [
              "set(list) is the fastest way to remove duplicate items from a list.",
              "& finds the intersection (items present in both sets).",
              "| finds the union (all items from either set)."
            ],
            expectedOutput: "Unique elements: {1, 2, 3, 4, 5}\nIn both clubs: {'Maya'}",
            commonMistakes: [
              "Creating an empty set with {} (that creates an empty dictionary!). Use set() for an empty set."
            ],
            tryItYourself: "Deduplicate the list [\"cat\", \"dog\", \"cat\", \"bird\"] using set().",
            starterCode: "animals = [\"cat\", \"dog\", \"cat\", \"bird\"]\nprint(list(set(animals)))\n",
            practiceQuestion: "How do you create an empty set in Python?"
          }
        ]
      }
    ]
  },
  {
    unitNumber: 13,
    title: "Basic Problem Solving",
    description: "Algorithmic thinking, accumulator patterns, finding min/max, and palindrome checks.",
    topics: [
      {
        topicNumber: 1,
        title: "Accumulator & Counting Patterns",
        description: "Summing, averaging, and counting occurrences in a sequence.",
        lessons: [
          {
            title: "Summing & Counting Algorithms",
            whatIsIt: "The accumulator pattern initializes a variable (usually 0) and adds to it in each step of a loop.",
            whyUseIt: "Calculate total cart costs, class attendance counts, or running totals.",
            syntax: "total = 0\nfor x in items:\n    total += x",
            example: "scores = [85, 92, 78, 90, 88]\ntotal = 0\nfor s in scores:\n    total += s\naverage = total / len(scores)\nprint(f\"Total: {total}, Average: {average:.1f}\")",
            explanation: [
              "total starts at 0.",
              "In each iteration, total += s adds the current score.",
              ":.1f formats the average to 1 decimal place."
            ],
            expectedOutput: "Total: 433, Average: 86.6",
            commonMistakes: [
              "Resetting total = 0 inside the loop body (this forgets past items!)."
            ],
            tryItYourself: "Count how many numbers in [12, -4, 5, -1, 0, 8] are positive.",
            starterCode: "nums = [12, -4, 5, -1, 0, 8]\npositive_count = 0\nfor n in nums:\n    if n > 0:\n        positive_count += 1\nprint(\"Positive count:\", positive_count)\n",
            practiceQuestion: "Where should the accumulator variable be initialized: before or inside the loop?"
          }
        ]
      },
      {
        topicNumber: 2,
        title: "Finding Min & Max",
        description: "Iterating through a collection to find the highest or lowest value.",
        lessons: [
          {
            title: "Finding Extremes Without Built-ins",
            whatIsIt: "Comparing each item against a current champion variable to track the highest or lowest value seen so far.",
            whyUseIt: "Core interview and exam pattern that teaches how algorithms traverse data.",
            syntax: "max_val = items[0]\nfor x in items:\n    if x > max_val: max_val = x",
            example: "temps = [72, 85, 68, 91, 79]\nhighest = temps[0]\nfor t in temps:\n    if t > highest:\n        highest = t\nprint(f\"Peak Temperature: {highest}°F\")",
            explanation: [
              "Start by assuming the first item is the highest.",
              "Whenever you see a larger value, update highest.",
              "By the end of the list, highest holds the absolute maximum."
            ],
            expectedOutput: "Peak Temperature: 91°F",
            commonMistakes: [
              "Initializing highest = 0 when the list contains negative numbers (e.g. [-5, -2, -10]). Always initialize with items[0]."
            ],
            tryItYourself: "Find the lowest number in [45, 12, 89, 3, 67].",
            starterCode: "nums = [45, 12, 89, 3, 67]\nlowest = nums[0]\nfor n in nums:\n    if n < lowest: lowest = n\nprint(\"Lowest:\", lowest)\n",
            practiceQuestion: "Why should you initialize highest to items[0] rather than 0?"
          }
        ]
      },
      {
        topicNumber: 3,
        title: "Palindrome Verification",
        description: "Checking if words and phrases read the same backward and forward.",
        lessons: [
          {
            title: "Palindrome Algorithm",
            whatIsIt: "A palindrome is a word, phrase, or number that reads the same backward as forward (e.g. 'racecar', 'madam').",
            whyUseIt: "Combines string normalization (lowercase, stripping punctuation) with slicing or two-pointer logic.",
            syntax: "clean = ''.join(c.lower() for c in s if c.isalnum())\nis_pal = clean == clean[::-1]",
            example: "def is_palindrome(text):\n    clean = \"\".join(c.lower() for c in text if c.isalnum())\n    return clean == clean[::-1]\n\nprint(\"racecar:\", is_palindrome(\"racecar\"))\nprint(\"hello:\", is_palindrome(\"hello\"))\nprint(\"A man, a plan, a canal: Panama!:\", is_palindrome(\"A man, a plan, a canal: Panama!\"))",
            explanation: [
              "c.isalnum() filters out spaces and punctuation.",
              "c.lower() makes the comparison case-insensitive.",
              "clean[::-1] reverses the string.",
              "clean == clean[::-1] returns True if symmetric."
            ],
            expectedOutput: "racecar: True\nhello: False\nA man, a plan, a canal: Panama!: True",
            commonMistakes: [
              "Comparing without converting to lowercase: 'Madam' != 'madaM'."
            ],
            tryItYourself: "Test if \"radar\" is a palindrome.",
            starterCode: "word = \"radar\"\nprint(word == word[::-1])\n",
            practiceQuestion: "What method checks if a character is either a letter or a digit in Python?"
          }
        ]
      }
    ]
  }
];
