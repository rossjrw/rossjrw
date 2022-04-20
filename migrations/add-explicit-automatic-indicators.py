#!/usr/bin/env python3
"""
This script changes log files from assuming whether an event is automatic
based on the action type to having explicit automatic indicators.
"""

import json
import sys

# Make sure we got a filename on the command line.
if len(sys.argv) < 2:
    print(f"Usage: python3.8 {sys.argv[0]} FILENAME")
    exit(1)

logFileName = sys.argv[1]

with open(logFileName, 'r') as logFile:
    log = json.loads(logFile.read())

for logItem in log:
    logItem['initiatedByPlayer'] = logItem['action'] == "move"

with open(logFileName, 'w') as logFile:
    logFile.write(json.dumps(log, indent=2))
