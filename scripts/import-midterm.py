"""Lossless content conversion; explicit rubric aliases make the supplied answers usable in-game."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
raw=json.loads((root/'public/data/computer_networks_midterm_quiz.original.json').read_text())
# These are grading aliases, not modifications to the supplied questions or model answers.
aliases={
'protocol':['protocols'],'messages':['message'],'actions':['action'],'router':['routers'],'switch':['switches'],
'hosts':['host','end systems','end system'],'routers':['router'],'frequency bands':['frequency band','bands'],'time slots':['slots','periodic slots'],
'queueing delay':['queuing delay','queues can build'],'queue':['queues','queued','queueing','queuing'],'dropped':['drop','drops','discarded'],
'retransmission':['retransmitted','retransmit','retransmits','resent'],'path':['paths'],'header':['headers'],
'false source address':['false source IP address','forged source IP address','fake source IP address'],
'no connection setup':['without connection setup','does not provide connection setup','connectionless'],
'local action':['local router action','local'],'global action':['global process','global'],
'resource sharing':['shares link resources','share resources','shared resources','on demand'],
'bursty traffic':['bursty'],'packet loss':['be lost','packets lost','packets are lost','lost packets'],
'reserved resources':['reserves end to end resources','reserve resources','reserves resources','reserved capacity'],
'lower layer':['layer below'],'modularization':['modules','modular'],'maintenance':['maintain','maintaining'],
'encapsulation':['adds a transport header','adding headers'],'minimum rate':['slowest constraining rate','min Rs Rc','slowest rate','minimum'],
'FDM':['Frequency Division Multiplexing'],'TDM':['Time Division Multiplexing'],
'circuit switching':['circuit switched','each call','calls'],
'clients':['client'],'direct communication':['communicate directly','directly communicate'],
'self scalability':['self scalable','self scalability'],'transport layer':['transport layer infrastructure'],
'cookie header':['response and request headers','cookie headers'],'cookies':['cookie','cookie identifier'],
'2 RTT':['two RTTs','2 RTTs','two RTT','2RTT'], '18 RTT':['18 RTTs','18RTT'],'3 RTT':['3 RTTs','3RTT'],
'persistent HTTP':['persistent pipelining'],'pipelining':['pipelined'],
'proxy server':['web cache','cache'],'proxy':['forwards unresolved queries','forwards queries','forward queries'],'cache hit':['already cached','cached object','object is cached'],
'access link traffic':['traffic on the access link','traffic on the institution s access link','access link'],
'Conditional GET':['If Modified Since'],'head-of-line blocking':['HOL blocking','head of line blocking'],
'interleaving':['interleave','interleaved'],'priority':['higher priority','prioritization'],
'user agent':['user agents'],'mail server':['mail servers'],'persistent connection':['persistent connections'],
'distributed':['distributes','distributing'],'hierarchical':['hierarchically','hierarchy'],'distance':['distant users','distant','link distance'],
'root DNS server':['root DNS servers','root server','root servers'], 'TLD DNS server':['TLD DNS servers','TLD server','TLD servers'],
'authoritative DNS server':['authoritative DNS servers','authoritative server','authoritative servers'],
'hostname-to-IP':['hostname to IP translation','hostname to IP mapping','name address translation'],
'cache':['caches','cached','caching'],'official mapping':['official hostname to IP mappings','official mappings','authoritative mapping'],
'name resolution':['name resolution process','resolution'],'DNS caching':['caching','cache'],
'root server':['root servers'],'DNS message':['DNS query and reply messages','DNS messages','DNS query','DNS reply'],
'answer RRs':['answers','answer records'],'authority RRs':['authority resource records','authority records'],
'additional RRs':['additional resource records','additional records'],
'NS record':['NS and A resource records','NS resource records','NS records'],'A record':['A resource records','A records'],'MX record':['MX records'],
'authoritative name server':['authoritative name servers'],
'retrieval':['retrieves','retrieve'],'expire':['expires','expiring','expiration','expiry'],'initiates':['initiate','starts','start'],'waits':['wait','listens','listen'],
'rate':['speed','rates'],'bits':['bit'],'entire packet':['whole packet','complete packet'],
'reliable transport':['reliable delivery','reliable data transfer'],'headers':['header'],
'load distribution':['load balancing'],'referral':['referrals'],'resolution':['resolves','resolve','resolving'],
'not found':['not found'],'large':['very large','increases','grows','infinity','unbounded','high'],
}
def group(key):return list(dict.fromkeys([key]+aliases.get(key,[])))
def groups(keys):return [group(k) for k in keys]
# Short-answer keywords in the source include topic labels; require the answer's substantive concepts instead.
sa={
1:['format','order','messages','actions'],2:[['host','a host','hosts']],3:['router','switch'],4:['network edge','hosts','network core','routers'],
5:['Frequency Division Multiplexing','frequency bands'],6:['Time Division Multiplexing','time slots'],7:[['L/R','L divided by R','packet length divided by link rate']],8:[['d/s','d divided by s','distance divided by propagation speed']],
9:['processing delay','queueing delay','transmission delay','propagation delay'],10:[['La/R','L*a/R','L a / R','L times a divided by R']],11:['large'],
12:['buffer','dropped'],13:['rate','bits'],14:[['constrains','limits','limiting','bottleneck','slowest'],'throughput'],
15:['forwarding','local','routing','global','path'],16:['entire packet',['before transmitting','before forwarding','before sending','before transmission']],
17:['application','transport','network','link','physical'],18:['message','segment','datagram','frame'],
19:[['adding','add','adds'],'header',['lower layer','lower layers','protocol stack']],20:['false source address'],21:['program','host'],
22:[['interface','door'],'messages'],23:['IP address','port number'],24:['initiates'],25:['waits'],26:['reliable transport','flow control','congestion control'],
27:['timing','minimum throughput'],28:['unreliable','no connection setup'],29:[['Hypertext Transfer Protocol']],30:[['does not maintain','does not remember','no memory','not remember','stateless'],'past requests'],
31:['non-persistent HTTP','TCP connection',['one object','single object'],'multiple objects'],32:['2 RTT'],33:['entity body'],34:['headers','GET'],35:['not found'],
36:['HTTP response','HTTP request','cookie file','backend database'],37:['response time','access link traffic'],38:[['avoid sending','avoids sending','not send','not modified','304'],['cached copy','cached object','up to date']],
39:['head-of-line blocking'],40:[['user agents','user agent'],['mail servers','mail server'],'SMTP'],41:[['send','sends','sending','transfer','transfers'],'mail server'],
42:['retrieval','server'],43:['distributed','hierarchical',['application layer','application layer protocol'],['name address translation','name to address','hostname to IP','names to addresses']],
44:['hostname-to-IP','host aliasing','mail server aliasing','load distribution'],45:['root DNS server','TLD DNS server','authoritative DNS server'],
46:['default name server','cache'],47:[['iterative','iterative query'],'referral',['recursive','recursive query'],'resolution'],48:[['Time To Live','time to live'],'cache','expire'],49:['name','value','type','ttl'],
50:[['A'],['IP address','IP'],['NS'],'authoritative name server',['CNAME'],'canonical name',['MX'],'mail server'],
}
def topic(q):
 s=q['question'].lower()
 for label,needles in [('DNS',['dns','hostname','name server']),('HTTP',['http','cookie','web cache','conditional get']),('E-mail',['smtp','imap','e-mail']),('Transport',['tcp','udp','transport']),('Delay & throughput',['delay','throughput','bottleneck','rtt','traffic intensity']),('Architecture',['layer','encapsulat','pdu','protocol stack']),('Network fundamentals',['internet','switch','router','network','protocol'])]:
  if any(n in s for n in needles):return label
 return 'Application layer'
questions=[]
for kind in ['true_false','multiple_choice','short_answer','open_ended']:
 for q in raw[kind]:
  answer=q.get('answer',q.get('sample_answer'))
  n={'id':q['id'],'type':kind,'prompt':q['question'],'explanation':q.get('explanation',answer),'topic':topic(q)}
  if kind=='true_false':n['answer']=answer
  elif kind=='multiple_choice':n.update(choices=[{'id':k,'text':v} for k,v in q['options'].items()],answer=answer)
  elif kind=='short_answer':
   idx=int(q['id'][2:]);n['answers']=[answer];n['concepts']=[k if isinstance(k,list) else group(k) for k in sa[idx]]
   if idx in [17,18,49]:n['ordered']=True
  else:n.update(modelAnswer=answer,concepts=groups(q['required_keywords']))
  questions.append(n)
pack={'version':1,'title':raw['metadata']['title'],'coverage':raw['metadata']['coverage'],'questions':questions}
(root/'public/data/questions.en.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n')
print('Converted',len(questions),'questions; original content preserved.')
