#!/usr/bin/env python3
"""
This script changes log files from recording events as pre-generated
messages to more useful event objects.
"""

import json
import re
import sys

# Make sure we got a filename on the command line.
if len(sys.argv) < 2:
    print(f"Usage: python3.8 {sys.argv[0]} FILENAME");
    exit(1);

logFileName = sys.argv[1]

with open(logFileName, 'r') as logFile:
    log = json.loads(logFile.read())

for logItem in log:
    message = logItem.pop('message')

    events = {
        'rosetteClaimed':    False,
        'captureHappened':   False,
        'ascensionHappened': False,
        'gameWon':           False,
    }

    fromPosition = None
    if match := re.search(r"onto the board", message):
        fromPosition = 0
    if match := re.search(r"from position (\d+)", message):
        fromPosition = int(match.group(1))

    toPosition = None
    if match := re.search(r"to position (\d+)", message):
        toPosition = int(match.group(1))
    if match := re.search(r"ascended", message):
        toPosition = 15
        events['ascensionHappened'] = True

    roll = None
    if match := re.search(r"rolled a (\d)", message):
        roll = int(match.group(1))
    elif fromPosition is not None and toPosition is not None:
        roll = toPosition - fromPosition
        # There is an edge case where if 8 is occupied, landing on 8 pushes you
        # forward onto 9, but it's not trivial to determine whether or not that
        # happened on this turn so I'm not going to bother. In this case the
        # roll will be reported as being 1 higher than it actually was.

    if match := re.search(r"claimed a rosette", message):
        events['rosetteClaimed'] = True

    if match := re.search(r"captured", message):
        events['captureHappened'] = True

    if match := re.search(r"won the game", message):
        events['gameWon'] = True

    logItem['events'] = events
    logItem['fromPosition'] = fromPosition
    logItem['toPosition'] = toPosition
    logItem['roll'] = roll

with open(logFileName, 'w') as logFile:
    logFile.write(json.dumps(log, indent=2))
